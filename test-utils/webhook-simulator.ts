import crypto from "crypto";

interface WebhookEvent {
  id: string;
  object: string;
  api_version: string;
  created: number;
  type: string;
  data: {
    object: any;
    previous_attributes?: any;
  };
  livemode: boolean;
  pending_webhooks: number;
  request: {
    id: string | null;
    idempotency_key: string | null;
  };
}

// Generate exact Stripe webhook signature with proper validation
function generateStripeSignature(
  payload: WebhookEvent,
  secret: string
): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadString = JSON.stringify(payload);
  const signedPayload = `${timestamp}.${payloadString}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");

  return `t=${timestamp},v1=${signature}`;
}

// Validate timestamp is within acceptable range (5 minutes)
function validateTimestamp(timestamp: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const tolerance = 300; // 5 minutes
  return Math.abs(now - timestamp) <= tolerance;
}

// Generate proper Stripe ID formats
function generateStripeId(prefix: string): string {
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  return `${prefix}_test_${randomSuffix}`;
}

// Webhook event templates with complete Stripe format
const webhookEvents = {
  subscriptionCreated: (
    userId: string,
    customerId: string,
    tierName: string
  ): WebhookEvent => {
    const subscriptionId = generateStripeId("sub");
    const currentTime = Math.floor(Date.now() / 1000);

    return {
      id: generateStripeId("evt"),
      object: "event",
      api_version: "2020-08-27",
      created: currentTime,
      type: "customer.subscription.created",
      data: {
        object: {
          id: subscriptionId,
          object: "subscription",
          application_fee_percent: null,
          billing_cycle_anchor: currentTime,
          billing_thresholds: null,
          cancel_at: null,
          cancel_at_period_end: false,
          canceled_at: null,
          collection_method: "charge_automatically",
          created: currentTime,
          current_period_end: currentTime + 30 * 24 * 60 * 60,
          current_period_start: currentTime,
          customer: customerId,
          days_until_due: null,
          default_payment_method: null,
          default_source: null,
          default_tax_rates: [],
          discount: null,
          ended_at: null,
          items: {
            object: "list",
            data: [
              {
                id: generateStripeId("si"),
                object: "subscription_item",
                created: currentTime,
                metadata: {},
                price: {
                  id: `price_test_${tierName}`,
                  object: "price",
                  active: true,
                  billing_scheme: "per_unit",
                  created: currentTime,
                  currency: "usd",
                  livemode: false,
                  metadata: {},
                  nickname: null,
                  recurring: {
                    aggregate_usage: null,
                    interval: "month",
                    interval_count: 1,
                    trial_period_days: null,
                    usage_type: "licensed",
                  },
                  tax_behavior: "unspecified",
                  tiers_mode: null,
                  transform_quantity: null,
                  type: "recurring",
                  unit_amount: tierName === "tier_20k" ? 4000 : 2000,
                  unit_amount_decimal:
                    tierName === "tier_20k" ? "4000" : "2000",
                },
                quantity: 1,
                subscription: subscriptionId,
                tax_rates: [],
              },
            ],
            has_more: false,
            total_count: 1,
            url: `/v1/subscription_items?subscription=${subscriptionId}`,
          },
          latest_invoice: null,
          livemode: false,
          metadata: {
            userId: userId,
            tierName: tierName,
            credits:
              tierName === "tier_20k"
                ? "20000"
                : tierName === "tier_40k"
                ? "40000"
                : "10000",
          },
          next_pending_invoice_item_invoice: null,
          pause_collection: null,
          payment_settings: {
            payment_method_options: null,
            payment_method_types: null,
            save_default_payment_method: "on_subscription",
          },
          pending_invoice_item_interval: null,
          pending_setup_intent: null,
          pending_update: null,
          schedule: null,
          start_date: currentTime,
          status: "active",
          transfer_data: null,
          trial_end: null,
          trial_start: null,
        },
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: generateStripeId("req"),
        idempotency_key: null,
      },
    };
  },

  subscriptionUpdated: (
    userId: string,
    customerId: string,
    tierName: string,
    status: string = "active"
  ): WebhookEvent => {
    const subscriptionId = generateStripeId("sub");
    const currentTime = Math.floor(Date.now() / 1000);

    return {
      id: generateStripeId("evt"),
      object: "event",
      api_version: "2020-08-27",
      created: currentTime,
      type: "customer.subscription.updated",
      data: {
        object: {
          id: subscriptionId,
          object: "subscription",
          billing_cycle_anchor: currentTime,
          cancel_at_period_end: false,
          canceled_at: null,
          collection_method: "charge_automatically",
          created: currentTime - 5 * 24 * 60 * 60, // Created 5 days ago
          current_period_end: currentTime + 25 * 24 * 60 * 60, // 25 days remaining
          current_period_start: currentTime - 5 * 24 * 60 * 60,
          customer: customerId,
          default_payment_method: null,
          discount: null,
          ended_at: null,
          items: {
            object: "list",
            data: [
              {
                id: generateStripeId("si"),
                object: "subscription_item",
                price: {
                  id: `price_test_${tierName}`,
                  recurring: { interval: "month" },
                },
                quantity: 1,
              },
            ],
          },
          livemode: false,
          metadata: {
            userId: userId,
            tierName: tierName,
            credits: tierName === "tier_40k" ? "40000" : "20000",
          },
          schedule: null,
          start_date: currentTime - 5 * 24 * 60 * 60,
          status: status,
          trial_end: null,
          trial_start: null,
        },
        previous_attributes: {
          status: "active", // Previous status before update
        },
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: generateStripeId("req"),
        idempotency_key: null,
      },
    };
  },

  subscriptionDeleted: (userId: string, customerId: string): WebhookEvent => {
    const currentTime = Math.floor(Date.now() / 1000);

    return {
      id: generateStripeId("evt"),
      object: "event",
      api_version: "2020-08-27",
      created: currentTime,
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: generateStripeId("sub"),
          object: "subscription",
          cancel_at_period_end: false,
          canceled_at: currentTime,
          created: currentTime - 10 * 24 * 60 * 60, // Created 10 days ago
          current_period_end: currentTime + 20 * 24 * 60 * 60,
          current_period_start: currentTime - 10 * 24 * 60 * 60,
          customer: customerId,
          ended_at: currentTime,
          livemode: false,
          metadata: {
            userId: userId,
            tierName: "tier_20k",
          },
          status: "canceled",
        },
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: generateStripeId("req"),
        idempotency_key: null,
      },
    };
  },

  invoicePaymentSucceeded: (customerId: string): WebhookEvent => {
    const currentTime = Math.floor(Date.now() / 1000);
    const invoiceId = generateStripeId("in");

    return {
      id: generateStripeId("evt"),
      object: "event",
      api_version: "2020-08-27",
      created: currentTime,
      type: "invoice.payment_succeeded",
      data: {
        object: {
          id: invoiceId,
          object: "invoice",
          account_country: "US",
          account_name: "SearchLeads",
          account_tax_ids: null,
          amount_due: 4000,
          amount_paid: 4000,
          amount_remaining: 0,
          application_fee_amount: null,
          attempt_count: 1,
          attempted: true,
          auto_advance: false,
          billing_reason: "subscription_cycle",
          charge: generateStripeId("ch"),
          collection_method: "charge_automatically",
          created: currentTime,
          currency: "usd",
          custom_fields: null,
          customer: customerId,
          customer_address: null,
          customer_email: "test@example.com",
          customer_name: "Test Customer",
          customer_phone: null,
          customer_shipping: null,
          customer_tax_exempt: "none",
          customer_tax_ids: [],
          default_payment_method: null,
          description: null,
          discount: null,
          due_date: null,
          ending_balance: 0,
          footer: null,
          hosted_invoice_url: `https://invoice.stripe.com/i/acct_test/${invoiceId}`,
          invoice_pdf: `https://pay.stripe.com/invoice/${invoiceId}/pdf`,
          livemode: false,
          metadata: {},
          next_payment_attempt: null,
          number: `INV-${Date.now()}`,
          paid: true,
          payment_intent: generateStripeId("pi"),
          payment_settings: {
            payment_method_options: null,
            payment_method_types: null,
          },
          period_end: currentTime,
          period_start: currentTime - 30 * 24 * 60 * 60,
          post_payment_credit_notes_amount: 0,
          pre_payment_credit_notes_amount: 0,
          receipt_number: null,
          starting_balance: 0,
          statement_descriptor: null,
          status: "paid",
          status_transitions: {
            finalized_at: currentTime,
            marked_uncollectible_at: null,
            paid_at: currentTime,
            voided_at: null,
          },
          subscription: generateStripeId("sub"),
          subtotal: 4000,
          tax: null,
          total: 4000,
          total_tax_amounts: [],
          transfer_data: null,
          webhooks_delivered_at: currentTime,
        },
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: generateStripeId("req"),
        idempotency_key: null,
      },
    };
  },

  invoicePaymentFailed: (customerId: string): WebhookEvent => {
    const currentTime = Math.floor(Date.now() / 1000);

    return {
      id: generateStripeId("evt"),
      object: "event",
      api_version: "2020-08-27",
      created: currentTime,
      type: "invoice.payment_failed",
      data: {
        object: {
          id: generateStripeId("in"),
          object: "invoice",
          amount_due: 4000,
          amount_paid: 0,
          amount_remaining: 4000,
          attempt_count: 1,
          attempted: true,
          billing_reason: "subscription_cycle",
          charge: null,
          collection_method: "charge_automatically",
          created: currentTime,
          currency: "usd",
          customer: customerId,
          livemode: false,
          next_payment_attempt: currentTime + 24 * 60 * 60, // Retry in 24h
          paid: false,
          payment_intent: generateStripeId("pi"),
          status: "open",
          subscription: generateStripeId("sub"),
          subtotal: 4000,
          total: 4000,
        },
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: generateStripeId("req"),
        idempotency_key: null,
      },
    };
  },

  invoicePaymentActionRequired: (customerId: string): WebhookEvent => {
    const currentTime = Math.floor(Date.now() / 1000);

    return {
      id: generateStripeId("evt"),
      object: "event",
      api_version: "2020-08-27",
      created: currentTime,
      type: "invoice.payment_action_required",
      data: {
        object: {
          id: generateStripeId("in"),
          object: "invoice",
          amount_due: 4000,
          amount_paid: 0,
          amount_remaining: 4000,
          attempt_count: 1,
          attempted: true,
          billing_reason: "subscription_cycle",
          charge: null,
          collection_method: "charge_automatically",
          created: currentTime,
          currency: "usd",
          customer: customerId,
          livemode: false,
          next_payment_attempt: null,
          paid: false,
          payment_intent: {
            id: generateStripeId("pi"),
            status: "requires_action",
            next_action: {
              type: "use_stripe_sdk",
              use_stripe_sdk: {
                type: "three_d_secure_redirect",
              },
            },
          },
          status: "open",
          subscription: generateStripeId("sub"),
          subtotal: 4000,
          total: 4000,
        },
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: generateStripeId("req"),
        idempotency_key: null,
      },
    };
  },

  customerDeleted: (customerId: string): WebhookEvent => {
    const currentTime = Math.floor(Date.now() / 1000);

    return {
      id: generateStripeId("evt"),
      object: "event",
      api_version: "2020-08-27",
      created: currentTime,
      type: "customer.deleted",
      data: {
        object: {
          id: customerId,
          object: "customer",
          deleted: true,
        },
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: generateStripeId("req"),
        idempotency_key: null,
      },
    };
  },

  paymentIntentSucceeded: (userId: string, credits: string): WebhookEvent => {
    const currentTime = Math.floor(Date.now() / 1000);
    const creditsNum = parseInt(credits);
    // Assuming $0.01 per credit, so 1000 credits = $10.00 = 1000 cents
    const amountInCents = creditsNum;

    return {
      id: generateStripeId("evt"),
      object: "event",
      api_version: "2020-08-27",
      created: currentTime,
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: generateStripeId("pi"),
          object: "payment_intent",
          amount: amountInCents,
          amount_capturable: 0,
          amount_received: amountInCents,
          application: null,
          application_fee_amount: null,
          canceled_at: null,
          cancellation_reason: null,
          capture_method: "automatic",
          charges: {
            object: "list",
            data: [
              {
                id: generateStripeId("ch"),
                object: "charge",
                amount: amountInCents,
                captured: true,
                created: currentTime,
                currency: "usd",
                paid: true,
                status: "succeeded",
              },
            ],
            has_more: false,
            total_count: 1,
          },
          client_secret: `pi_test_${Date.now()}_secret_abc123`,
          confirmation_method: "automatic",
          created: currentTime,
          currency: "usd",
          customer: generateStripeId("cus"),
          description: "Credit Purchase",
          invoice: null,
          last_payment_error: null,
          livemode: false,
          metadata: {
            userId: userId,
            credits: credits,
            currency: "usd",
            clientName: "Test Client",
          },
          next_action: null,
          payment_method: generateStripeId("pm"),
          receipt_email: null,
          status: "succeeded",
          transfer_data: null,
        },
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: generateStripeId("req"),
        idempotency_key: null,
      },
    };
  },
};

export class WebhookSimulator {
  private webhookSecret: string;
  private targetUrl: string;

  constructor(
    webhookSecret: string,
    targetUrl: string = "http://localhost:3001/api/payments/searchLeadsConfirmPayment"
  ) {
    this.webhookSecret = webhookSecret;
    this.targetUrl = targetUrl;
  }

  async sendWebhook(eventType: string, params: any = {}): Promise<any> {
    let event: WebhookEvent;

    try {
      switch (eventType) {
        case "subscriptionCreated":
          event = webhookEvents.subscriptionCreated(
            params.userId,
            params.customerId,
            params.tierName
          );
          break;
        case "subscriptionUpdated":
          event = webhookEvents.subscriptionUpdated(
            params.userId,
            params.customerId,
            params.tierName,
            params.status
          );
          break;
        case "subscriptionDeleted":
          event = webhookEvents.subscriptionDeleted(
            params.userId,
            params.customerId
          );
          break;
        case "invoicePaymentSucceeded":
          event = webhookEvents.invoicePaymentSucceeded(params.customerId);
          break;
        case "invoicePaymentFailed":
          event = webhookEvents.invoicePaymentFailed(params.customerId);
          break;
        case "invoicePaymentActionRequired":
          event = webhookEvents.invoicePaymentActionRequired(params.customerId);
          break;
        case "customerDeleted":
          event = webhookEvents.customerDeleted(params.customerId);
          break;
        case "paymentIntentSucceeded":
          event = webhookEvents.paymentIntentSucceeded(
            params.userId,
            params.credits
          );
          break;
        default:
          throw new Error(
            `Unknown event type: ${eventType}. Available: ${Object.keys(
              webhookEvents
            ).join(", ")}`
          );
      }

      // Validate event structure
      if (!event.id || !event.type || !event.data) {
        throw new Error("Invalid webhook event structure");
      }

      // Validate timestamp
      if (!validateTimestamp(event.created)) {
        console.warn(
          "⚠️ Webhook timestamp outside tolerance, but continuing..."
        );
      }

      const signature = generateStripeSignature(event, this.webhookSecret);

      console.log(`🔄 Sending ${eventType} webhook (${event.id})...`);
      console.log(`📡 Target: ${this.targetUrl}`);

      const response = await fetch(this.targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Stripe-Signature": signature,
          "User-Agent": "Stripe/1.0 (+https://stripe.com/docs/webhooks)",
          "Stripe-Version": "2020-08-27",
        },
        body: JSON.stringify(event),
      });

      const responseText = await response.text();
      let result;

      try {
        result = JSON.parse(responseText);
      } catch {
        result = { raw: responseText };
      }

      console.log(`✅ Status: ${response.status}`);
      console.log(`📄 Response:`, result);

      if (response.status >= 400) {
        console.error(`❌ Webhook failed with status ${response.status}`);
      }

      return result;
    } catch (error) {
      console.error(`❌ Error sending ${eventType}:`, (error as Error).message);
      throw error;
    }
  }

  async runCompleteSubscriptionFlow(
    userId: string,
    customerId: string
  ): Promise<void> {
    console.log("🚀 Running complete subscription flow...\n");

    try {
      // 1. Create subscription
      await this.sendWebhook("subscriptionCreated", {
        userId,
        customerId,
        tierName: "tier_20k",
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 2. Monthly billing
      await this.sendWebhook("invoicePaymentSucceeded", { customerId });
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 3. Upgrade subscription
      await this.sendWebhook("subscriptionUpdated", {
        userId,
        customerId,
        tierName: "tier_40k",
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 4. Cancel subscription
      await this.sendWebhook("subscriptionDeleted", { userId, customerId });

      console.log("\n✅ Complete subscription flow finished");
    } catch (error) {
      console.error("❌ Subscription flow failed:", error);
      throw error;
    }
  }

  async runErrorScenarios(userId: string, customerId: string): Promise<void> {
    console.log("⚠️ Running error scenarios...\n");

    try {
      // 1. Payment failure
      await this.sendWebhook("invoicePaymentFailed", { customerId });
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 2. Action required (SCA)
      await this.sendWebhook("invoicePaymentActionRequired", { customerId });
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 3. Customer deletion
      await this.sendWebhook("customerDeleted", { customerId });

      console.log("\n✅ Error scenarios completed");
    } catch (error) {
      console.error("❌ Error scenarios failed:", error);
      throw error;
    }
  }
}
