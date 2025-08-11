// mock-stripe-client.ts
import crypto from "crypto";

// Stripe error format - exact match to API
interface StripeError {
  error: {
    code: string;
    message: string;
    param?: string;
    type: string;
  };
}

function createStripeError(
  code: string,
  message: string,
  param?: string,
  type: string = "invalid_request_error"
): StripeError {
  return {
    error: {
      code,
      message,
      param,
      type,
    },
  };
}

// Proper webhook signature verification - matches Stripe exactly
function verifyWebhookSignature(
  body: any,
  signature: string,
  secret: string
): any {
  try {
    // Parse Stripe signature format: t=timestamp,v1=signature
    const sigElements = signature.split(",");
    let timestamp: string | null = null;
    let v1Signature: string | null = null;

    for (const element of sigElements) {
      const [key, value] = element.split("=");
      if (key === "t") {
        timestamp = value;
      } else if (key === "v1") {
        v1Signature = value;
      }
    }

    if (!timestamp || !v1Signature) {
      throw new Error("Invalid signature format");
    }

    // Check timestamp (should be within 5 minutes)
    const currentTime = Math.floor(Date.now() / 1000);
    const webhookTime = parseInt(timestamp);
    if (Math.abs(currentTime - webhookTime) > 300) {
      // 5 minutes
      throw new Error("Timestamp outside tolerance");
    }

    // FIXED: Handle Buffer body correctly
    let bodyString: string;
    if (Buffer.isBuffer(body)) {
      bodyString = body.toString("utf8");
    } else if (typeof body === "string") {
      bodyString = body;
    } else {
      bodyString = JSON.stringify(body);
    }

    // Verify signature using the same format as generator
    const payload = timestamp + "." + bodyString;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload, "utf8")
      .digest("hex");

    if (expectedSignature !== v1Signature) {
      console.error("Signature mismatch:");
      console.error("Expected:", expectedSignature);
      console.error("Received:", v1Signature);
      console.error("Payload:", payload.substring(0, 200) + "...");
      throw new Error("Invalid signature");
    }

    // Return parsed event
    const eventData =
      typeof bodyString === "string" ? JSON.parse(bodyString) : bodyString;
    console.log(`✅ Webhook signature verified for event: ${eventData.type}`);
    return eventData;
  } catch (error) {
    console.error(
      "Webhook signature verification failed:",
      (error as Error).message
    );
    throw new Error("Invalid signature");
  }
}

export const mockStripeClient = {
  webhooks: {
    constructEvent: (body: any, sig: string, secret: string) => {
      return verifyWebhookSignature(body, sig, secret);
    },
  },

  customers: {
    list: async (params: { email?: string; limit?: number }) => {
      if (!params.email) {
        throw createStripeError(
          "parameter_missing",
          "Missing required parameter: email",
          "email"
        );
      }

      const { MOCK_STRIPE_CUSTOMERS } = await import("./mock-stripe-data");
      const customer = MOCK_STRIPE_CUSTOMERS[params.email];

      return {
        object: "list",
        data: customer ? [customer] : [],
        has_more: false,
        total_count: customer ? 1 : 0,
        url: "/v1/customers",
      };
    },

    create: async (params: any) => {
      if (!params.email) {
        throw createStripeError(
          "parameter_missing",
          "Missing required parameter: email",
          "email"
        );
      }

      const customerId = `cus_mock_${Date.now()}`;
      return {
        id: customerId,
        object: "customer",
        created: Math.floor(Date.now() / 1000),
        email: params.email,
        name: params.name || null,
        phone: params.phone || null,
        address: params.address || null,
        description: params.description || null,
        balance: 0,
        currency: params.currency || "usd",
        delinquent: false,
        discount: null,
        invoice_prefix: customerId.slice(-8),
        invoice_settings: {
          custom_fields: null,
          default_payment_method: null,
          footer: null,
        },
        livemode: false,
        metadata: params.metadata || {},
        shipping: null,
        sources: {
          object: "list",
          data: [],
          has_more: false,
          total_count: 0,
          url: `/v1/customers/${customerId}/sources`,
        },
        subscriptions: {
          object: "list",
          data: [],
          has_more: false,
          total_count: 0,
          url: `/v1/customers/${customerId}/subscriptions`,
        },
        tax_exempt: "none",
        tax_ids: {
          object: "list",
          data: [],
          has_more: false,
          total_count: 0,
          url: `/v1/customers/${customerId}/tax_ids`,
        },
      };
    },

    retrieve: async (customerId: string) => {
      if (!customerId) {
        throw createStripeError(
          "parameter_missing",
          "Missing required parameter: customer",
          "customer"
        );
      }

      return {
        id: customerId,
        object: "customer",
        created: Math.floor(Date.now() / 1000),
        email: "test@example.com",
        name: "Test Customer",
        balance: 0,
        currency: "usd",
        delinquent: false,
        deleted: false,
        livemode: false,
        metadata: {},
      };
    },

    update: async (customerId: string, params: any) => {
      if (!customerId) {
        throw createStripeError(
          "parameter_missing",
          "Missing required parameter: customer",
          "customer"
        );
      }

      return {
        id: customerId,
        object: "customer",
        created: Math.floor(Date.now() / 1000),
        email: params.email || "test@example.com",
        name: params.name || "Test Customer",
        balance: 0,
        currency: "usd",
        delinquent: false,
        livemode: false,
        metadata: params.metadata || {},
        ...params,
      };
    },

    deleteDiscount: async (customerId: string) => {
      if (!customerId) {
        throw createStripeError(
          "parameter_missing",
          "Missing required parameter: customer",
          "customer"
        );
      }

      return {
        id: customerId,
        object: "customer",
        discount: null,
      };
    },
  },

  subscriptions: {
    create: async (params: any) => {
      if (!params.customer) {
        throw createStripeError(
          "parameter_missing",
          "Missing required parameter: customer",
          "customer"
        );
      }

      if (
        !params.items ||
        !Array.isArray(params.items) ||
        params.items.length === 0
      ) {
        throw createStripeError(
          "parameter_missing",
          "Missing required parameter: items",
          "items"
        );
      }

      const subscriptionId = `sub_mock_${Date.now()}`;
      const currentTime = Math.floor(Date.now() / 1000);

      return {
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
        customer: params.customer,
        days_until_due: null,
        default_payment_method: null,
        default_source: null,
        default_tax_rates: [],
        discount: null,
        ended_at: null,
        items: {
          object: "list",
          data: params.items.map((item: any, index: number) => ({
            id: `si_mock_${Date.now()}_${index}`,
            object: "subscription_item",
            created: currentTime,
            metadata: {},
            price: item.price,
            quantity: item.quantity || 1,
            subscription: subscriptionId,
            tax_rates: [],
          })),
          has_more: false,
          total_count: params.items.length,
          url: `/v1/subscription_items?subscription=${subscriptionId}`,
        },
        latest_invoice: {
          id: `in_mock_${Date.now()}`,
          object: "invoice",
          payment_intent: {
            id: `pi_mock_${Date.now()}`,
            object: "payment_intent",
            client_secret: `pi_mock_${Date.now()}_secret_abc123`,
            status: "requires_payment_method",
          },
        },
        livemode: false,
        metadata: params.metadata || {},
        next_pending_invoice_item_invoice: null,
        pause_collection: null,
        payment_settings: {
          payment_method_options: null,
          payment_method_types: null,
          save_default_payment_method:
            params.payment_settings?.save_default_payment_method || null,
        },
        pending_invoice_item_interval: null,
        pending_setup_intent: null,
        pending_update: null,
        schedule: null,
        start_date: currentTime,
        status: "incomplete",
        transfer_data: null,
        trial_end: null,
        trial_start: null,
      };
    },

    cancel: async (subscriptionId: string, params?: any) => {
      if (!subscriptionId) {
        throw createStripeError(
          "parameter_missing",
          "Missing required parameter: subscription",
          "subscription"
        );
      }

      const currentTime = Math.floor(Date.now() / 1000);

      return {
        id: subscriptionId,
        object: "subscription",
        status: "canceled",
        canceled_at: currentTime,
        cancel_at_period_end: false,
        current_period_end: currentTime + 30 * 24 * 60 * 60,
        current_period_start: currentTime - 5 * 24 * 60 * 60,
        customer: "cus_mock_customer",
        ended_at: currentTime,
        livemode: false,
        metadata: {},
      };
    },
  },

  paymentIntents: {
    create: async (params: any) => {
      if (!params.amount || typeof params.amount !== "number") {
        throw createStripeError(
          "parameter_invalid_integer",
          "Invalid integer: amount",
          "amount"
        );
      }

      if (!params.currency) {
        throw createStripeError(
          "parameter_missing",
          "Missing required parameter: currency",
          "currency"
        );
      }

      const paymentIntentId = `pi_mock_${Date.now()}`;

      return {
        id: paymentIntentId,
        object: "payment_intent",
        amount: params.amount,
        amount_capturable: 0,
        amount_received: 0,
        application: null,
        application_fee_amount: null,
        canceled_at: null,
        cancellation_reason: null,
        capture_method: "automatic",
        charges: {
          object: "list",
          data: [],
          has_more: false,
          total_count: 0,
          url: `/v1/charges?payment_intent=${paymentIntentId}`,
        },
        client_secret: `${paymentIntentId}_secret_abc123`,
        confirmation_method: "automatic",
        created: Math.floor(Date.now() / 1000),
        currency: params.currency,
        customer: params.customer || null,
        description: params.description || null,
        invoice: null,
        last_payment_error: null,
        livemode: false,
        metadata: params.metadata || {},
        next_action: null,
        on_behalf_of: null,
        payment_method: null,
        payment_method_options: {},
        payment_method_types: params.automatic_payment_methods?.enabled
          ? ["card"]
          : [],
        receipt_email: null,
        review: null,
        setup_future_usage: null,
        shipping: null,
        source: null,
        statement_descriptor: null,
        statement_descriptor_suffix: null,
        status: "requires_payment_method",
        transfer_data: null,
        transfer_group: null,
      };
    },

    cancel: async (paymentIntentId: string, params: any) => {
      if (!paymentIntentId) {
        throw createStripeError(
          "parameter_missing",
          "Missing required parameter: payment_intent",
          "payment_intent"
        );
      }

      return {
        id: paymentIntentId,
        object: "payment_intent",
        status: "canceled",
        canceled_at: Math.floor(Date.now() / 1000),
        cancellation_reason:
          params.cancellation_reason || "requested_by_customer",
        amount: 2000,
        currency: "usd",
        livemode: false,
        metadata: {},
      };
    },
  },

  coupons: {
    retrieve: async (couponCode: string) => {
      if (!couponCode) {
        throw createStripeError(
          "parameter_missing",
          "Missing required parameter: coupon",
          "coupon"
        );
      }

      return {
        id: couponCode,
        object: "coupon",
        amount_off: null,
        created: Math.floor(Date.now() / 1000),
        currency: null,
        duration: "forever",
        duration_in_months: null,
        livemode: false,
        max_redemptions: 100,
        metadata: {},
        name: "Test Coupon",
        percent_off: 10,
        redeem_by: null,
        times_redeemed: 25,
        valid: true,
      };
    },
  },

  prices: {
    list: async (params: any) => {
      const { MOCK_STRIPE_PRICES } = await import("./mock-stripe-data");

      // Filter by parameters if provided
      let filteredPrices = MOCK_STRIPE_PRICES;

      if (params.active !== undefined) {
        filteredPrices = filteredPrices.filter(
          (price) => price.active === params.active
        );
      }

      if (params.type) {
        filteredPrices = filteredPrices.filter(
          (price) => price.type === params.type
        );
      }

      return {
        object: "list",
        data: filteredPrices,
        has_more: false,
        total_count: filteredPrices.length,
        url: "/v1/prices",
      };
    },
  },
};
