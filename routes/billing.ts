// billing.ts

import express from "express";
import dotenv from "dotenv";
import {
  createInvoiceEntry,
  createSubscriptionInvoiceEntry,
  getInvoiceByBillingID,
  getInvoicesByUserID,
} from "../db/billing";
import s3 from "../db/s3";
import { getUser } from "../db/user";
import userAuth from "../middleware/supabaseAuth";
import { stripeClient } from "../payments/stripe";
import { createInvoice, createSubscriptionInvoice } from "../utils/createInvoice";
import { FormattedInvoice, UpcomingInvoiceInfo } from "../types/interfaces";
dotenv.config();
const app = express.Router();
 const costPerLead = parseFloat(process.env.COSTPERLEAD as string);

app.post("/createInvoice", userAuth, async (req, res) => {
  try {
    const userID = (req as any).user.id;

    const user = await getUser(userID);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const { quantity, unitCost, currency, amountPaid, from, creditsRequested } =
      req.body;

    // Create invoice here
    const invoiceData = await createInvoice(
      from,
      user.name,
      quantity,
      unitCost,
      currency,
      amountPaid
    );

    if (!invoiceData) throw new Error("Invoice generation failed");    
    const time = new Date().getTime();
    const fileName = `${from}-${userID}-${time}.pdf`;
    const param = {
      Bucket: "SearchleadsInvoices",
      Key: fileName,
      Body: invoiceData,
      // ACL: "public-read",
      ContentType: "application/pdf",
    };

    const uploadedInvoice = await s3.upload(param).promise();
    if (!uploadedInvoice) {
      res.status(500).json({ message: "Invoice not uploaded" });
      return;
    }

    const invoiceLog = await createInvoiceEntry(
      userID,
      uploadedInvoice.ETag.replace(/"/g, ""),
      uploadedInvoice.Location,
      creditsRequested
    );
    if (!invoiceLog) {
      res.status(500).json({ message: "Invoice logging failed" });
      return;
    }

    res
      .status(200)
      .json({ message: "Invoice created successfully", invoice: uploadedInvoice.Location });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// app.post("/createSubscriptionInvoice", userAuth, async (req, res) => {
export async function createSubscriptionInvoiceFromWebhook(userId: string): Promise<void> {
  try {
    const userID = userId;
    const user = await getUser(userID);
    
    if (!user) {
      console.error("User not found");
      // res.status(404).json({ message: "User not found" });
      return;
    }

    if (!user.stripeCustomerId || !user.stripeSubscriptionId) {
      // res.status(400).json({ message: "No active Stripe subscription found" });
      console.error("No active Stripe subscription found");
      return;
    }

    // Fetch the latest paid invoice for the subscription
    const invoices = await stripeClient.invoices.list({
      customer: user.stripeCustomerId,
      subscription: user.stripeSubscriptionId,
      limit: 1,
      status: "paid",
      expand: ['data.subscription_details'], 
    });
    

    if (!invoices.data.length) {
      console.error("No paid subscription invoice found");
      // res.status(404).json({ message: "No paid subscription invoice found" });
      return;
    }

    const invoice = invoices.data[0];
    // console.log("Fetched invoice from Stripe:", invoices.data[0]);

    const metadata = invoice.subscription_details?.metadata || invoice.metadata || {};

    // Optionally, log/store the invoice in your DB
    const invoiceData = await createSubscriptionInvoice(
      invoice.account_name || '',
      invoice.customer_name || user.name || '',
      invoice.currency.toUpperCase(),
      metadata?.credits ? (parseInt(metadata.credits)/1000) * costPerLead : 0,
      metadata?.tierName || '',
      invoice.status || '',
      invoice.customer_email || '',
      invoice.customer_name || '',
      invoice.issuer?.type || '',
      'Subscription',
      invoice.customer_address?.line1 || '',
      invoice.customer_phone || '',
    );

    // console.log("User for subscription invoice:", invoiceData);

    if (!invoiceData) {
      // throw new Error("Invoice generation failed");
      console.error("Invoice generation failed");
      return;
    }    
    
    const time = new Date().getTime();
    const fileName = `${invoice.account_name}-${userID}-${time}.pdf`;
    const param = {
      Bucket: "SearchleadsInvoices",
      Key: fileName,
      Body: invoiceData,
      // ACL: "public-read",
      ContentType: "application/pdf",
    };

    const uploadedInvoice = await s3.upload(param).promise();
    if (!uploadedInvoice) {
      // res.status(500).json({ message: "Invoice not uploaded" });
       console.error("Invoice not uploaded");
      return;
    }

    const invoiceLog = await createSubscriptionInvoiceEntry(
      userID,
      uploadedInvoice.ETag.replace(/"/g, ""),
      uploadedInvoice.Location,
      metadata?.credits ? parseInt(metadata.credits) : 0,
      metadata?.tierName || '',
      invoice.status || '',
      invoice.customer_email || '',
      invoice.customer_name || '',
      invoice.issuer?.type || '',
      'Subscription'
    );
    
    if (!invoiceLog) {
      console.error("Invoice logging failed");
      // res.status(500).json({ message: "Invoice logging failed" });
      return;
    }

    // res
    //   .status(200)
    //   .json({ message: "Subscription invoice created successfully", invoice: uploadedInvoice.Location });

     console.log("Subscription invoice created successfully:", uploadedInvoice.Location);

  } catch (e: any) {
    // res.status(500).json({ message: e.message });
    console.error("Error in createSubscriptionInvoice:", e.message || e);
  }
};

app.get("/getBillsByUser", userAuth, async (req, res) => {
  try {
    const userID = (req as any).user.id;

    const bills = await getInvoicesByUserID(userID);
    if (!bills) {
      res.status(404).json({ message: "Bills not found" });
      return;
    }

    res.status(200).json({ bills });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

app.post("/getBill", userAuth, async (req, res) => {
  try {
    const { billingID } = req.body;

    if (!billingID) {
      res.status(404).json({ message: "Bill id is required" });
      return;
    }

    const bill = await getInvoiceByBillingID(billingID);
    if (!bill) {
      res.status(404).json({ message: "Bill not found" });
      return;
    }

    res.status(200).json({ bill });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// NEW: Get subscription invoices from Stripe
app.get("/getSubscriptionInvoices", userAuth, async (req, res) => {
  try {
    const userID = (req as any).user.id;
    const user = await getUser(userID);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (!user.stripeCustomerId) {
      res.status(200).json({ subscriptionInvoices: [] });
      return;
    }

    // Fetch subscription invoices from Stripe
    const invoices = await stripeClient.invoices.list({
      customer: user.stripeCustomerId,
      limit: 50,
    });

    const formattedInvoices = invoices.data.map((invoice) => ({
      id: invoice.id,
      amount: invoice.amount_paid / 100, // Convert from cents
      currency: invoice.currency.toUpperCase(),
      status: invoice.status,
      date: new Date(invoice.created * 1000),
      subscriptionId: invoice.subscription,
      invoiceUrl: invoice.hosted_invoice_url,
      invoicePdf: invoice.invoice_pdf,
      description: invoice.description || "Subscription payment",
      periodStart: invoice.period_start
        ? new Date(invoice.period_start * 1000)
        : null,
      periodEnd: invoice.period_end
        ? new Date(invoice.period_end * 1000)
        : null,
    }));

    res.status(200).json({ subscriptionInvoices: formattedInvoices });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// NEW: Get complete billing history (manual + subscription invoices)
app.get("/getAllBillingHistory", userAuth, async (req, res) => {
  try {
    const userID = (req as any).user.id;
    const user = await getUser(userID);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Get manual invoices
    const manualBills = await getInvoicesByUserID(userID);

    // Format manual invoices with proper typing
    const formattedManualBills: FormattedInvoice[] = (manualBills || []).map(
      (bill) => ({
        id: bill.BillingID,
        type: "manual" as const,
        amount: bill.CreditsRequested,
        currency: "USD",
        status: "paid",
        date: bill.date,
        description: `Manual credit purchase - ${bill.CreditsRequested} credits`,
        invoiceUrl: bill.Url,
        creditsProvided: bill.CreditsRequested,
      })
    );

    // Get subscription invoices if customer exists with proper typing
    let formattedSubscriptionInvoices: FormattedInvoice[] = [];
    if (user.stripeCustomerId) {
      try {
        const invoices = await stripeClient.invoices.list({
          customer: user.stripeCustomerId,
          limit: 50,
        });

        formattedSubscriptionInvoices = invoices.data.map((invoice) => ({
          id: invoice.id,
          type: "subscription" as const,
          amount: invoice.amount_paid / 100,
          currency: invoice.currency.toUpperCase(),
          status: invoice.status || "unknown", // Handle null status
          date: new Date(invoice.created * 1000),
          subscriptionId: invoice.subscription as string,
          invoiceUrl: invoice.hosted_invoice_url || undefined,
          invoicePdf: invoice.invoice_pdf || undefined,
          description: invoice.description || "Subscription payment",
          periodStart: invoice.period_start
            ? new Date(invoice.period_start * 1000)
            : null,
          periodEnd: invoice.period_end
            ? new Date(invoice.period_end * 1000)
            : null,
          creditsProvided: invoice.metadata?.credits
            ? parseInt(invoice.metadata.credits)
            : null,
        }));
      } catch (stripeError: unknown) {
        console.error("Error fetching subscription invoices:", stripeError);
      }
    }

    // Combine and sort by date (newest first)
    const allBillingHistory: FormattedInvoice[] = [
      ...formattedManualBills,
      ...formattedSubscriptionInvoices,
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.status(200).json({
      billingHistory: allBillingHistory,
      summary: {
        totalInvoices: allBillingHistory.length,
        manualInvoices: formattedManualBills.length,
        subscriptionInvoices: formattedSubscriptionInvoices.length,
      },
    });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// NEW: Get specific subscription invoice details
app.get("/getSubscriptionInvoice/:invoiceId", userAuth, async (req, res) => {
  try {
    const userID = (req as any).user.id;
    const { invoiceId } = req.params;
    const user = await getUser(userID);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (!user.stripeCustomerId) {
      res.status(404).json({ message: "No subscription customer found" });
      return;
    }

    // Fetch specific invoice from Stripe
    const invoice = await stripeClient.invoices.retrieve(invoiceId);

    // Verify invoice belongs to this customer
    if (invoice.customer !== user.stripeCustomerId) {
      res.status(403).json({ message: "Invoice does not belong to this user" });
      return;
    }

    const detailedInvoice = {
      id: invoice.id,
      amount: invoice.amount_paid / 100,
      currency: invoice.currency.toUpperCase(),
      status: invoice.status,
      date: new Date(invoice.created * 1000),
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      subscriptionId: invoice.subscription,
      invoiceUrl: invoice.hosted_invoice_url,
      invoicePdf: invoice.invoice_pdf,
      description: invoice.description || "Subscription payment",
      periodStart: invoice.period_start
        ? new Date(invoice.period_start * 1000)
        : null,
      periodEnd: invoice.period_end
        ? new Date(invoice.period_end * 1000)
        : null,
      attemptCount: invoice.attempt_count,
      nextPaymentAttempt: invoice.next_payment_attempt
        ? new Date(invoice.next_payment_attempt * 1000)
        : null,
      lineItems: invoice.lines.data.map((item) => ({
        description: item.description,
        amount: item.amount / 100,
        quantity: item.quantity,
        priceId: item.price?.id,
      })),
      creditsProvided: invoice.metadata?.credits
        ? parseInt(invoice.metadata.credits)
        : null,
    };

    res.status(200).json({ invoice: detailedInvoice });
  } catch (e: any) {
    if (e.type === "StripeInvalidRequestError") {
      res.status(404).json({ message: "Invoice not found" });
    } else {
      res.status(500).json({ message: e.message });
    }
  }
});

app.get("/getSubscriptionBillingStatus", userAuth, async (req, res) => {
  try {
    const userID = (req as any).user.id;
    const user = await getUser(userID);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (!user.stripeCustomerId || !user.stripeSubscriptionId) {
      res.status(200).json({
        hasActiveSubscription: false,
        message: "No active subscription found",
      });
      return;
    }

    const subscription = await stripeClient.subscriptions.retrieve(
      user.stripeSubscriptionId
    );

    const billingStatus = {
      hasActiveSubscription: true,
      subscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      plan: user.subscriptionPlan,
      creditsRemaining: user.subscriptionCredits,
      upcomingInvoice: null as UpcomingInvoiceInfo | null,
    };

    if (subscription.status === "active") {
      try {
        const upcomingInvoice = await stripeClient.invoices.retrieveUpcoming({
          customer: user.stripeCustomerId,
        });

        billingStatus.upcomingInvoice = {
          amount: upcomingInvoice.amount_due / 100,
          currency: upcomingInvoice.currency.toUpperCase(),
          periodStart: new Date(upcomingInvoice.period_start * 1000),
          periodEnd: new Date(upcomingInvoice.period_end * 1000),
        };
      } catch (upcomingError: unknown) {
        console.log(
          "No upcoming invoice found or error:",
          (upcomingError as Error).message
        );
      }
    }

    res.status(200).json({ billingStatus });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

export default app;
