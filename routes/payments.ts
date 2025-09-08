// payments.ts

import userAuth from "../middleware/supabaseAuth";
import express, { Request, Response } from "express";
import Stripe from "stripe";
import { addCredits, addCreditsWithSearchCredits, getUser } from "../db/user";
import { createSubscriptionInvoiceFromWebhook } from './billing';
import { stripeClient } from "../payments/stripe";
import {
  getSubscriptionTiers,
  updateUserSubscription,
  updateUserSubscriptionWithTimestamp,
  resetMonthlyCredits,
  getUserByStripeCustomerId,
  setUpgradeLock,
} from "../db/subscription";
import {
  SubscriptionCreateRequest,
  SubscriptionUpgradeRequest,
  SubscriptionMetadata,
  StripePaymentMetadata,
} from "../types/interfaces";
import {
  isEventProcessed,
  markEventProcessed,
} from "../utils/webhookIdempotency";
import { deletePendingUpgrade, getPendingUpgrade } from "../db/pendingUpgrades";
import { makeUpstashRequest } from "../caching/redis";
import { User } from "@prisma/client";
import { prisma } from "../db/index";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express.Router();
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;
const percentageOfCredits = process.env.PERCENTAGE ? parseInt(process.env.PERCENTAGE, 10) : 10;

app.post("/searchLeadsConfirmPayment", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
  let eventId: string | null = null;

  console.log("-------- INSIDE /searchLeadsConfirmPayment --------");

  try {
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      return res.status(400).json({ error: "Missing Stripe signature" });
    }

    let event: Stripe.Event;

    try {
      console.log("Raw body type:",req.body, typeof req.body, Buffer.isBuffer(req.body));

      event = stripeClient.webhooks.constructEvent(
        req.body,
        sig,
        endpointSecret
      );

      console.log("Event :", event);

      eventId = event.id;
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return res.status(400).json({ error: "Invalid signature" });
    }

    if (await isEventProcessed(eventId)) {
      console.log(`Event ${eventId} already processed, skipping`);
      return res.status(200).json({ received: true, duplicate: true });
    }

    console.log(`Processing webhook: ${event.type} (ID: ${eventId})`);

    let SUBSCRIPTION_TIERS: any = null;
    if (event.type.includes("subscription") || event.type.includes("invoice")) {
      SUBSCRIPTION_TIERS = await getSubscriptionTiers();
    }

    switch (event.type) {
      /**
       * PAYMENT_INTENT.SUCCEEDED - Handle one-time credit purchases only
       * Subscription payments are handled via invoice.payment_succeeded
       */
      case "payment_intent.succeeded":
        try {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.log("-- PAYMENT INTENT ID :", paymentIntent.id);

          // Skip subscription-related payments - handled by invoice webhook
          if (
            paymentIntent.description === "Subscription update" ||
            paymentIntent.description?.includes("subscription")
          ) {
            console.log(
              `Skipping subscription payment intent: ${paymentIntent.id}`
            );
            await markEventProcessed(eventId, {
              eventId: event.id,
              timestamp: event.created,
              eventType: event.type,
              processedAt: Date.now(),
            });
            return res
              .status(200)
              .json({ received: true, subscription_handled_elsewhere: true });
          }

          // Handle EnrichMinion credits
          if (
            paymentIntent.description === "Payment for EnrichMinion Credits"
          ) {
            console.log(
              `Processing EnrichMinion credit payment: ${paymentIntent.id}`
            );
            await markEventProcessed(eventId, {
              eventId: event.id,
              timestamp: event.created,
              eventType: event.type,
              processedAt: Date.now(),
            });
            return res
              .status(200)
              .json({ received: true, reason: "for enrichminion" });
          }

          // Handle regular credit purchases
          const metadata =
            paymentIntent.metadata as unknown as StripePaymentMetadata;
          if (metadata && !metadata.subscriptionPlan && metadata.credits) {
            // Verify payment actually succeeded with charge
            if (
              !paymentIntent.latest_charge ||
              paymentIntent.amount_received <= 0
            ) {
              console.error(
                `❌ PaymentIntent ${paymentIntent.id} shows succeeded but no charge/amount!`
              );
              return res
                .status(200)
                .json({ error: "No actual payment detected" });
            }

            console.log(
              `💰 Verified credit purchase: $${
                paymentIntent.amount_received / 100
              } (Charge: ${paymentIntent.latest_charge})`
            );
          /*
            const updatedCredits = await addCreditsWithSearchCredits(
              parseFloat(metadata.credits),
              parseFloat(((parseFloat(metadata.credits) * percentageOfCredits) / 100).toString()),
              metadata.userId
            );

            if (!updatedCredits) {
              console.error(
                `Failed to add credits for user ${metadata.userId}, payment ${paymentIntent.id}`
              );
              return res.status(200).json({ error: "Failed to add credits" });
            }

            console.log(
              `✅ Added ${metadata.credits} credits to user ${metadata.userId}`
            ); */
            await markEventProcessed(eventId, {
              eventId: event.id,
              timestamp: event.created,
              eventType: event.type,
              processedAt: Date.now(),
            });
            return res.status(200).json({ received: true });
          }

          console.warn(`Unhandled payment intent: ${paymentIntent.id}`);
        } catch (error) {
          console.error("Error processing payment_intent.succeeded:", error);
          return res.status(200).json({ error: "Payment processing failed" });
        }
        break;

      /**
       * INVOICE.PAYMENT_SUCCEEDED - The authoritative payment confirmation
       * This is the ONLY place where we confirm subscription payments
       */
      case "invoice.payment_succeeded":
        try {
          const invoice = event.data.object as Stripe.Invoice;
          console.log("-- INVOICE ID :", invoice.id);

          // CRITICAL: Verify actual payment before processing
          // Handle both manual payments and auto-charged payments
          if (invoice.amount_paid <= 0) {
            console.error(
              `❌ Invoice ${invoice.id} shows payment succeeded but no amount paid!`
            );
            return res
              .status(200)
              .json({ error: "No actual payment detected" });
          }

          // For auto-charged invoices, check payment_intent instead of charge
          let paymentConfirmation = "unknown";
          if (invoice.charge) {
            paymentConfirmation = `charge: ${invoice.charge}`;
          } else if (invoice.payment_intent) {
            paymentConfirmation = `payment_intent: ${invoice.payment_intent}`;
          } else {
            paymentConfirmation = "auto-paid via saved payment method";
          }

          console.log(
            `💰 Verified invoice payment: $${
              invoice.amount_paid / 100
            } (${paymentConfirmation})`
          );

          // Additional verification for auto-charged payments
          if (invoice.status === "paid" && invoice.amount_paid > 0) {
            console.log(
              `✅ Payment confirmed: Invoice status is 'paid' with amount $${
                invoice.amount_paid / 100
              }`
            );
          } else {
            console.error(
              `❌ Payment verification failed: status=${invoice.status}, amount=${invoice.amount_paid}`
            );
            return res
              .status(200)
              .json({ error: "Payment verification failed" });
          }

          /**
           * Handle subscription creation payments (including upgrades)
           */
          if (
            invoice.subscription &&
            invoice.billing_reason === "subscription_create"
          ) {
            console.log(
              `🎉 Processing subscription creation payment for: ${invoice.subscription}`
            );

            const subscription = await stripeClient.subscriptions.retrieve(
              invoice.subscription as string
            );
            const subMetadata =
              subscription.metadata as unknown as SubscriptionMetadata;

            if (subMetadata?.userId) {
              const tier =
                SUBSCRIPTION_TIERS?.[
                  subMetadata.tierName as keyof typeof SUBSCRIPTION_TIERS
                ];

              // Check if this is an upgrade scenario
              if (subMetadata.isUpgrade === "true" && subMetadata.upgradeFrom) {
                console.log(
                  `🔄 Processing upgrade swap: replacing ${subMetadata.upgradeFrom} with ${subscription.id}`
                );

                // Cancel old subscription with retry logic
                await cancelOldSubscriptionWithRetry(
                  subMetadata.upgradeFrom,
                  6
                );

                // Update user with new subscription
                await updateUserSubscriptionWithTimestamp(subMetadata.userId, {
                  stripeCustomerId: subscription.customer as string,
                  stripeSubscriptionId: subscription.id,
                  subscriptionStatus: "active",
                  subscriptionPlan: subMetadata.tierName,
                  subscriptionCredits: tier?.credits || 0,
                  subscriptionCurrentPeriodEnd: new Date(
                    subscription.current_period_end * 1000
                  ),
                  last_webhook_timestamp: event.created,
                  last_processed_event_id: event.id,
                  upgrade_lock: false, // Clear upgrade lock
                  searchCredits: parseFloat(((parseInt(tier.credits) * percentageOfCredits) / 100).toString()),
                  });

                console.log(
                  `✅ Completed upgrade swap for user ${subMetadata.userId}: ${
                    subMetadata.tierName
                  } with ${tier?.credits || 0} credits`
                );
              } else {
                // Regular subscription creation
                await updateUserSubscriptionWithTimestamp(subMetadata.userId, {
                  stripeCustomerId: subscription.customer as string,
                  stripeSubscriptionId: subscription.id,
                  subscriptionStatus: "active",
                  subscriptionPlan: subMetadata.tierName,
                  subscriptionCredits: tier?.credits || 0,
                  subscriptionCurrentPeriodEnd: new Date(
                    subscription.current_period_end * 1000
                  ),
                  last_webhook_timestamp: event.created,
                  last_processed_event_id: event.id,
                  searchCredits: parseFloat(((parseInt(tier.credits) * percentageOfCredits) / 100).toString()),
                  });

                console.log(
                  `✅ Activated subscription for user ${subMetadata.userId}: ${
                    subMetadata.tierName
                  } with ${tier?.credits || 0} credits`
                );
                // const subscription = await stripeClient.subscriptions.retrieve(
                //   invoice.subscription as string
                // );
                // const subMetadata =
                //   subscription.metadata as unknown as SubscriptionMetadata;
                if(subMetadata?.userId && subscription.id) {  
                  console.log(`✅ Invoice logged called for user ${subMetadata.userId} `);
                  const invoiceLogged =  await createSubscriptionInvoiceFromWebhook(subMetadata.userId, subscription.id);
                }
              }
            }
          }

          /**
           * Handle subscription upgrade payments (legacy pending upgrade system)
           */
          if (
            invoice.subscription &&
            invoice.billing_reason === "subscription_update"
          ) {
            console.log(
              `🔄 Processing legacy subscription upgrade payment for: ${invoice.subscription}`
            );

            const pendingUpgrade = await getPendingUpgrade(
              invoice.subscription as string
            );

            if (pendingUpgrade) {
              console.log(
                `✅ Found pending upgrade for user ${pendingUpgrade.userId} to ${pendingUpgrade.targetTierName}`
              );

              await updateUserSubscriptionWithTimestamp(pendingUpgrade.userId, {
                subscriptionCredits: pendingUpgrade.targetCredits,
                subscriptionPlan: pendingUpgrade.targetTierName,
                subscriptionStatus: "active",
                last_webhook_timestamp: event.created,
                last_processed_event_id: event.id,
                searchCredits: parseFloat((((pendingUpgrade.targetCredits) * percentageOfCredits) / 100).toString()),
              });

              console.log(
                `🎉 Applied legacy upgrade: ${pendingUpgrade.targetTierName} with ${pendingUpgrade.targetCredits} credits`
              );

              await deletePendingUpgrade(invoice.subscription as string);
              console.log(
                `🗑️ Cleaned up pending upgrade for subscription ${invoice.subscription}`
              );
            } else {
              console.warn(
                `⚠️ No pending upgrade found for subscription ${invoice.subscription}`
              );
            }
          }

          /**
           * Handle subscription renewal payments
           */
          if (
            invoice.subscription &&
            invoice.billing_reason === "subscription_cycle"
          ) {
            console.log(
              `🔄 Processing subscription renewal for: ${invoice.subscription}`
            );

            const customer = await stripeClient.customers.retrieve(
              invoice.customer as string
            );
            if (customer && !customer.deleted) {
              const user = await getUserByStripeCustomerId(customer.id);
              if (user?.subscriptionPlan) {
                const tier =
                  SUBSCRIPTION_TIERS?.[
                    user.subscriptionPlan as keyof typeof SUBSCRIPTION_TIERS
                  ];
                if (tier) {
                  await resetMonthlyCredits(user.UserID, tier.credits);
                  console.log(
                    `✅ Reset monthly credits to ${tier.credits} for user ${user.UserID}`
                  );
                }
              }
            }
          }

          await markEventProcessed(event.id, {
            eventId: event.id,
            timestamp: event.created,
            eventType: event.type,
            subscriptionId: invoice.subscription as string,
            processedAt: Date.now(),
          });

          return res
            .status(200)
            .json({ received: true, payment_confirmed: true });
        } catch (error) {
          console.error("Error processing invoice payment succeeded:", error);
          return res.status(200).json({ error: "Invoice processing failed" });
        }
        break;

      /**
       * SUBSCRIPTION.CREATED/UPDATED - Only for metadata tracking
       * Payment confirmation is handled in invoice.payment_succeeded
       */
      case "customer.subscription.created":
      case "customer.subscription.updated":
        try {
          const subscription = event.data.object as Stripe.Subscription;
          console.log(
            `📝 Subscription ${event.type}: ${subscription.id} (status: ${subscription.status})`
          );

          // Skip if pending update exists - handled by invoice webhook
          if (subscription.pending_update) {
            console.log(
              `Subscription ${subscription.id} has pending update, skipping processing`
            );
            await markEventProcessed(event.id, {
              eventId: event.id,
              timestamp: event.created,
              eventType: event.type,
              subscriptionId: subscription.id,
              processedAt: Date.now(),
            });
            return res.status(200).json({ received: true, pending: true });
          }

          // Only process non-payment related changes (status updates, etc.)
          if (subscription.status !== "active") {
            const subMetadata =
              subscription.metadata as unknown as SubscriptionMetadata;

            if (subMetadata?.userId) {
              const user = await getUserByStripeCustomerId(
                subscription.customer as string
              );

              if (user && user.stripeSubscriptionId === subscription.id) {
                // This is their current subscription, update their status
                await updateUserSubscriptionWithTimestamp(subMetadata.userId, {
                  subscriptionStatus: subscription.status,
                  last_webhook_timestamp: event.created,
                  last_processed_event_id: event.id,
                });

                console.log(
                  `Updated subscription status for user ${subMetadata.userId}: ${subscription.status}`
                );
              } else {
                console.log(
                  `🗑️ Ignoring status update for non-current subscription ${subscription.id} (status: ${subscription.status})`
                );
              }
            }
          }

          await markEventProcessed(event.id, {
            eventId: event.id,
            timestamp: event.created,
            eventType: event.type,
            subscriptionId: subscription.id,
            processedAt: Date.now(),
          });
        } catch (error) {
          console.error("Error processing subscription event:", error);
          return res
            .status(200)
            .json({ error: "Subscription processing failed" });
        }
        break;

      /**
       * Handle subscription cancellation
       */
      case "customer.subscription.deleted":
        try {
          const deletedSub = event.data.object as Stripe.Subscription;
          const delMetadata =
            deletedSub.metadata as unknown as SubscriptionMetadata;

          if (delMetadata?.userId) {
            // ✅ CRITICAL: Only clear user data if this was their CURRENT subscription
            const user = await getUserByStripeCustomerId(
              deletedSub.customer as string
            );

            if (user && user.stripeSubscriptionId === deletedSub.id) {
              console.log(
                `🎯 Processing cancellation of current subscription ${deletedSub.id} for user ${delMetadata.userId}`
              );
              await updateUserSubscription(delMetadata.userId, {
                  subscriptionStatus: null,
                  stripeSubscriptionId: null,
                  subscriptionPlan: null,
                  subscriptionCurrentPeriodEnd: null,
                  subscriptionCredits: 0,  // Expire credits when subscription ends
              });

                console.log(
                  `✅ Expired credits at subscription end and canceled subscription for user ${delMetadata.userId} | Canceled subscription id :${deletedSub.id}`
                );
            } else {
              // This was an old subscription (probably from upgrade), ignore it
              console.log(
                `🗑️ Deleted old subscription ${deletedSub.id} for user ${delMetadata.userId}, keeping current subscription intact`
              );
            }
          }

          await markEventProcessed(event.id, {
            eventId: event.id,
            timestamp: event.created,
            eventType: event.type,
            processedAt: Date.now(),
          });
        } catch (error) {
          console.error("Error processing subscription deleted:", error);
          return res
            .status(200)
            .json({ error: "Subscription cancellation failed" });
        }
        break;

      /**
       * Handle payment failures - Clear upgrade locks for failed upgrade attempts
       */
      case "invoice.payment_failed":
        try {
          const failedInvoice = event.data.object as Stripe.Invoice;

          if (failedInvoice.subscription) {
            const subscription = await stripeClient.subscriptions.retrieve(
              failedInvoice.subscription as string
            );
            const subMetadata =
              subscription.metadata as unknown as SubscriptionMetadata;

            // Clear upgrade lock if this was a failed upgrade attempt
            if (subMetadata?.isUpgrade === "true" && subMetadata?.userId) {
              await setUpgradeLock(subMetadata.userId, false);
              console.log(
                `🔓 Cleared upgrade lock for failed upgrade attempt: user ${subMetadata.userId}`
              );

              // Auto-delete failed upgrade subscription
              await stripeClient.subscriptions.cancel(
                failedInvoice.subscription as string
              );
              console.log(
                `🗑️ Auto-deleted failed upgrade subscription: ${failedInvoice.subscription}`
              );
            } else {
              // Handle regular subscription payment failures
              const customer = await stripeClient.customers.retrieve(
                failedInvoice.customer as string
              );

              if (customer && !customer.deleted) {
                const user = await getUserByStripeCustomerId(customer.id);

                if (user) {
                  if (failedInvoice.billing_reason === "subscription_create") {
                    console.log(
                      `❌ Initial subscription payment failed for user ${user.UserID}, cleaning up`
                    );

                    await stripeClient.subscriptions.cancel(
                      failedInvoice.subscription as string
                    );
                    await updateUserSubscription(user.UserID, {
                      subscriptionStatus: null,
                      stripeSubscriptionId: null,
                      subscriptionPlan: null,
                      subscriptionCredits: 0,
                    });

                    console.log(
                      `Cleaned up failed initial subscription for user ${user.UserID}`
                    );
                  } else {
                    await updateUserSubscription(user.UserID, {
                      subscriptionStatus: "past_due",
                    });

                    console.log(
                      `Marked subscription as past_due for user ${user.UserID}`
                    );
                  }
                }
              }
            }
          }

          await markEventProcessed(event.id, {
            eventId: event.id,
            timestamp: event.created,
            eventType: event.type,
            subscriptionId: failedInvoice.subscription as string,
            processedAt: Date.now(),
          });
        } catch (error) {
          console.error("Error processing invoice payment failed:", error);
          return res
            .status(200)
            .json({ error: "Failed payment processing failed" });
        }
        break;

      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
        break;
    }

    await markEventProcessed(eventId, {
      eventId: event.id,
      timestamp: event.created,
      eventType: event.type,
      processedAt: Date.now(),
    });

    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error(`Webhook processing error (Event ID: ${eventId}):`, error);
    return res
      .status(200)
      .json({ error: `Internal Server Error: ${error.message}` });
  }
});

/**
 * CREATE SUBSCRIPTION - Immediate Payment Required
 * Uses payment_behavior='default_incomplete' for immediate payment requirement
 */
app.post(
  "/createSubscription",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      const { customerId, tierName, userId, referral }: SubscriptionCreateRequest =
        req.body;

      const SUBSCRIPTION_TIERS = await getSubscriptionTiers();

      if (!SUBSCRIPTION_TIERS[tierName as keyof typeof SUBSCRIPTION_TIERS]) {
        return res.status(400).json({ error: "Invalid subscription tier" });
      }

      const tier =
        SUBSCRIPTION_TIERS[tierName as keyof typeof SUBSCRIPTION_TIERS];
      console.log(
        `---------------- Creating subscription: ${tierName} for user: ${userId}`
      );

      // Create subscription with immediate payment requirement
      const subscription = await stripeClient.subscriptions.create({
        customer: customerId,
        items: [{ price: tier.priceId }],
        payment_behavior: "default_incomplete", // CRITICAL: Requires immediate payment
        expand: ["latest_invoice.payment_intent"],
        metadata: {
          _afficoneRef: referral || null,
          userId: userId,
          tierName: tierName,
          credits: tier.credits.toString(),
        },
      });

      const latestInvoice =
        subscription.latest_invoice as Stripe.Invoice | null;

      let clientSecret: string | null = null;
      let paymentIntentId: string | null = null;

      if (
        latestInvoice &&
        typeof latestInvoice !== "string" &&
        latestInvoice.payment_intent
      ) {
        if (typeof latestInvoice.payment_intent !== "string") {
          clientSecret = latestInvoice.payment_intent.client_secret ?? null;
          paymentIntentId = latestInvoice.payment_intent.id;
        } else {
          paymentIntentId = latestInvoice.payment_intent;
        }
      }

      // Attach extra metadata to payment intent (if needed)
      if (paymentIntentId) {
        await stripeClient.paymentIntents.update(paymentIntentId, {
          metadata: {
            userId,
            tierName,
            credits: tier.credits.toString(),
            _afficoneRef: referral || null,
            flow: "new_subscription",
          },
        });
      }

      console.log(
        `✅ Created subscription ${subscription.id} (status: ${subscription.status}) for user ${userId}`
      );

      res.status(200).json({
        subscriptionId: subscription.id,
        status: subscription.status,
        clientSecret,
        message: "Subscription created - payment required for activation",
      });
    } catch (error: any) {
      console.error("Create subscription error:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * UPGRADE SUBSCRIPTION - Immediate Proration Payment
 * Uses pending updates for graceful upgrade handling
 */
app.post(
  "/upgradeSubscription",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      const { customerId, newTierName, userId, referral }: SubscriptionUpgradeRequest =
        req.body;

      // Check for upgrade lock first
      const user = await getUserByStripeCustomerId(customerId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.upgrade_lock) {
        return res.status(400).json({
          error: "Upgrade already in progress",
          message: "Please wait for current upgrade to complete",
        });
      }

      // Set upgrade lock
      await setUpgradeLock(userId, true);

      try {
        const SUBSCRIPTION_TIERS = await getSubscriptionTiers();
        if (
          !SUBSCRIPTION_TIERS[newTierName as keyof typeof SUBSCRIPTION_TIERS]
        ) {
          await setUpgradeLock(userId, false);
          return res.status(400).json({ error: "Invalid subscription tier" });
        }

        const newTier =
          SUBSCRIPTION_TIERS[newTierName as keyof typeof SUBSCRIPTION_TIERS];

        if (!user.stripeSubscriptionId) {
          await setUpgradeLock(userId, false);
          return res
            .status(404)
            .json({ error: "No active subscription found" });
        }

        console.log(
          `---------------- Starting upgrade: user ${userId} to ${newTierName} from ${user.subscriptionPlan}`
        );

        // Create new subscription with immediate billing cycle
        const newSubscription = await stripeClient.subscriptions.create({
          customer: customerId,
          items: [{ price: newTier.priceId }],
          payment_behavior: "default_incomplete", // Immediate payment required
          expand: ["latest_invoice.payment_intent"],
          metadata: {
            _afficoneRef: referral || null,
            userId: userId,
            tierName: newTierName,
            credits: newTier.credits.toString(),
            upgradeFrom: user.stripeSubscriptionId, // Track which subscription this replaces
            isUpgrade: "true",
          },
        });

        const latestInvoice =
          newSubscription.latest_invoice as Stripe.Invoice | null;

        let clientSecret: string | null = null;
        let paymentIntentId: string | null = null;

        if (
          latestInvoice &&
          typeof latestInvoice !== "string" &&
          latestInvoice.payment_intent
        ) {
          if (typeof latestInvoice.payment_intent !== "string") {
            clientSecret = latestInvoice.payment_intent.client_secret ?? null;
            paymentIntentId = latestInvoice.payment_intent.id;
          } else {
            paymentIntentId = latestInvoice.payment_intent; // string ID
          }
        }

        if (paymentIntentId) {
          await stripeClient.paymentIntents.update(paymentIntentId, {
            metadata: {
              _afficoneRef: referral || null,
              userId,
              tierName: newTierName,
              credits: newTier.credits.toString(),
            },
          });
        }

        console.log(
          `✅ Created new subscription ${newSubscription.id} for upgrade (status: ${newSubscription.status}) for user ${userId}`
        );

        res.status(200).json({
          subscriptionId: newSubscription.id,
          status: newSubscription.status,
          clientSecret,
          upgradeAmount: latestInvoice?.amount_due || 0,
          message: "New subscription created - payment required for upgrade",
          targetTier: newTierName,
          targetCredits: newTier.credits,
        });
      } catch (error: any) {
        // Clear upgrade lock on any error
        await setUpgradeLock(userId, false);
        console.error("Upgrade subscription error:", error);
        throw error;
      }
    } catch (error: any) {
      console.error("Upgrade error:", error);
      res.status(500).json({
        message: error.message,
        type: error.type || "unknown_error",
      });
    }
  }
);

/**
 * CANCEL SUBSCRIPTION - Immediate cancellation
 */
app.post(
  "/cancelSubscription",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      const { subscriptionId, userId } = req.body;

      if (!subscriptionId) {
        res.status(400).json({ message: "Missing subscription Id" });
        return;
      }
      
      const user_id = (req as any).user.id;
      const user = await getUser(user_id);
      if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
      }

      if (user.stripeSubscriptionId !== subscriptionId) {
        res.status(403).json({ message: "You are not allowed to cancel this subscription" });
        return;
      }

      console.log(
        `---------------- Canceling subscription: ${subscriptionId} for user: ${userId ? userId : user_id}`
      );

      // const canceledSubscription = await stripeClient.subscriptions.cancel(
      //   subscriptionId,
      //   {
      //     prorate: false,
      //     invoice_now: false,
      //   }
      // );

      const canceledAtPeriodEnd = await stripeClient.subscriptions.update(
          subscriptionId,
          {
            cancel_at_period_end: true,
          }
      );

      await updateUserSubscription(user_id, {
                  subscriptionStatus: 'canceled',
          });
      console.log(
        `✅ Canceled subscription ${subscriptionId} - webhook will handle database cleanup`
      );

      res.status(200).json({
        subscription: canceledAtPeriodEnd,
        message: "Subscription canceled successfully",
      });
    } catch (error: any) {
      console.error("Cancel subscription error:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * Payment cancellation handler - Updated for pending updates
 */
app.post(
  "/paymentCancelledIntent",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      const { paymentIntentId, cancellationReason } = req.body;

      if (!paymentIntentId) {
        return res.status(400).json({
          success: false,
          error: "Payment Intent ID is required",
        });
      }

      console.log(`Processing payment cancellation: ${paymentIntentId}`);

      const paymentIntent = await stripeClient.paymentIntents.retrieve(
        paymentIntentId
      );

      if (paymentIntent.invoice) {
        const invoice = await stripeClient.invoices.retrieve(
          paymentIntent.invoice as string
        );

        if (invoice.subscription) {
          const subscription = await stripeClient.subscriptions.retrieve(
            invoice.subscription as string
          );
          const subMetadata =
            subscription.metadata as unknown as SubscriptionMetadata;

          // Handle upgrade cancellation
          if (subMetadata?.isUpgrade === "true" && subMetadata?.userId) {
            console.log(
              `Canceling upgrade attempt for user ${subMetadata.userId}`
            );

            // Clear upgrade lock
            await setUpgradeLock(subMetadata.userId, false);

            // Auto-delete failed upgrade subscription
            await stripeClient.subscriptions.cancel(
              invoice.subscription as string
            );

            return res.status(200).json({
              success: true,
              message: "Upgrade cancelled - original subscription preserved",
              actionTaken: "upgrade_cancelled",
            });
          }

          // Handle regular subscription cancellations
          const user = await getUserByStripeCustomerId(
            paymentIntent.customer as string
          );

          if (!user) {
            return res
              .status(404)
              .json({ success: false, error: "User not found" });
          }

          if (invoice.billing_reason === "subscription_create") {
            // Clean up failed initial subscription
            console.log(
              `Cleaning up initial subscription creation: ${invoice.subscription}`
            );

            await stripeClient.subscriptions.cancel(
              invoice.subscription as string
            );
            await updateUserSubscription(user.UserID, {
              subscriptionStatus: null,
              stripeSubscriptionId: null,
              subscriptionPlan: null,
              subscriptionCredits: 0,
              subscriptionCurrentPeriodEnd: null,
            });

            return res.status(200).json({
              success: true,
              message: "Initial subscription payment cancelled and cleaned up",
              actionTaken: "subscription_cleanup",
            });
          }
        }
      }

      // Handle direct payment intent cancellation
      try {
        await stripeClient.paymentIntents.cancel(paymentIntentId, {
          cancellation_reason: cancellationReason || "requested_by_customer",
        });

        return res.status(200).json({
          success: true,
          message: "Payment cancelled successfully",
          actionTaken: "payment_intent_cancelled",
        });
      } catch (cancelError: any) {
        if (cancelError.code === "payment_intent_unexpected_state") {
          return res.status(200).json({
            success: true,
            message: "Payment intent already in final state",
            actionTaken: "already_final_state",
          });
        }
        throw cancelError;
      }
    } catch (error: any) {
      console.error("Payment cancellation error:", error);
      return res.status(500).json({
        success: false,
        error: "Payment cancellation failed",
        message: error.message,
      });
    }
  }
);

// Utility endpoints
app.post(
  "/createPaymentIntent",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      const {
        amount,
        currency,
        costumerID,
        description,
        automaticPayment,
        referral,
        credits,
        userID,
        cientName,
      } = req.body;

      if (!currency || !credits) {
        return res.status(400).json({ message: "Invalid currency or credits" });
      }

      const selectedCurrency = currency.toUpperCase();
      const perThousandCredit = process.env.COSTPERLEAD || 5;
      // Base conversion: 1000 credits = $5
      const amountInUSD = parseInt(credits) * Number(perThousandCredit);

      const amountInUSDPerThousandCredit = amountInUSD / 1000;
      // console.log("amount :: ", credits, currency, selectedCurrency, perThousandCredit, amountInUSD, amountInUSDPerThousandCredit);
      // Fallback rates if env is not set
      const defaultRates: Record<string, number> = {
        USD: 1,
        INR: 88.188049,
        GBP: 0.74502,
        EUR: 0.859295,
      };

      const rates: Record<string, number> = {
        USD: parseFloat(process.env.USD_RATE || defaultRates.USD.toString()),
        INR: parseFloat(process.env.INR_RATE || defaultRates.INR.toString()),
        GBP: parseFloat(process.env.GBP_RATE || defaultRates.GBP.toString()),
        EUR: parseFloat(process.env.EUR_RATE || defaultRates.EUR.toString()),
      };

      const currencyRate = rates[selectedCurrency] ? rates[selectedCurrency] : defaultRates[selectedCurrency];

      // Calculate amount for Stripe (in smallest currency unit)
      const amountCalculated = Math.round(amountInUSDPerThousandCredit * currencyRate * 100);

      const paymentIntent = await stripeClient.paymentIntents.create({
        amount: amount ? amount : amountCalculated,
        currency: currency,
        customer: costumerID,
        description: description,
        automatic_payment_methods: {
          enabled: automaticPayment,
        },
        metadata: {
          _afficoneRef: referral || null,
          credits: credits,
          currency: currency,
          userId: userID,
          clientName: cientName,
        },
      });

      res.status(200).json({ paymentIntent });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

app.post(
  "/findCustomerByEmail",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      const customers = await stripeClient.customers.list({
        email: email,
        limit: 1,
      });

      if (customers.data.length > 0) {
        res.status(200).json({ customerId: customers.data[0].id });
      } else {
        res.status(404).json({ message: "Customer not found" });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

app.get(
  "/getAvailableSubscriptionTiers",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      const SUBSCRIPTION_TIERS = await getSubscriptionTiers();
      res.status(200).json(SUBSCRIPTION_TIERS);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

app.get(
  "/getSubscriptionStatus/:customerId",
  userAuth,
  async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;

      const user = await getUserByStripeCustomerId(customerId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const subscriptionData = {
        subscriptionStatus: user.subscriptionStatus,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionCredits: user.subscriptionCredits ?? 0,
        purchasedCredits: user.credits,
        totalCredits: (user.subscriptionCredits ?? 0) + user.credits,
        subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd,
      };

      res.status(200).json(subscriptionData);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Helper function to cancel old subscription with retry logic
async function cancelOldSubscriptionWithRetry(
  subscriptionId: string,
  maxRetries: number = 6
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `🔄 Attempting to cancel old subscription ${subscriptionId} (attempt ${attempt}/${maxRetries})`
      );

      await stripeClient.subscriptions.cancel(subscriptionId);

      console.log(
        `✅ Successfully canceled old subscription ${subscriptionId}`
      );
      return;
    } catch (error: any) {
      console.error(
        `❌ Failed to cancel subscription ${subscriptionId} on attempt ${attempt}:`,
        error.message
      );

      if (attempt === maxRetries) {
        console.error(
          `💥 Failed to cancel old subscription ${subscriptionId} after ${maxRetries} attempts`
        );
        throw new Error(
          `Failed to cancel old subscription after ${maxRetries} attempts: ${error.message}`
        );
      }

      // Wait 10 seconds before next retry
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
}

app.post("/createCustomer", userAuth, async (req: Request, res: Response) => {
  try {
    const { name, email, couponID } = req.body;
    const customer = await stripeClient.customers.create({
      name: name,
      email: email,
      coupon: couponID,
    });

    const user_id = (req as any).user.id;

    await prisma.user.update({
      where: { UserID: user_id },
      data: { stripeCustomerId: customer.id },
    });

    res.status(200).json({ customer });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

const RATE_LIMIT_WINDOW = 60; // seconds
const RATE_LIMIT_MAX = 5; // max requests per window

async function isRateLimited(userKey: string): Promise<boolean> {
  const now = Date.now();
  
  const key = `ratelimit:${userKey}`;

  const incrementResp = await makeUpstashRequest(["INCR", key]);

  if (incrementResp.error) {
    console.error("Rate limit increment failed:", incrementResp.error);
    return false;
  }

  const currentCount = Number(incrementResp.result);

  if (currentCount === 1) {
    await makeUpstashRequest(["EXPIRE", key, RATE_LIMIT_WINDOW.toString()]);
  }

  return currentCount > RATE_LIMIT_MAX;
}

app.post("/retrieveCoupon", userAuth, async (req: Request, res: Response) => {
  try {
    const { couponCode } = req.body;

    if (!couponCode) {
        return res.status(400).json({ message: "Missing coupon code" });
    }
    
    const userKey = (req as any).user?.id || req.ip;

    if (await isRateLimited(userKey)) {
        res.status(429).json({
          message: "Too many coupon requests. Please try again in 1 minute.",
        });
        return;
    }

    const coupon = await stripeClient.coupons.retrieve(couponCode);
    res.status(200).json({ coupon });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/deleteCustomer", userAuth, async (req: Request, res: Response) => {
  try {
    const { customerId } = req.body;
    const deletedCustomer = await stripeClient.customers.deleteDiscount(
      customerId
    );
    res.status(200).json({ deletedCustomer });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/updateCouponCode", userAuth, async (req: Request, res: Response) => {
  try {
    const { customerId, couponCode } = req.body;
    const updatedCustomer = await stripeClient.customers.update(customerId, {
      coupon: couponCode,
    });

    res.status(200).json({ updatedCustomer });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default app;
