// mock-services.ts
import express, { Request, Response } from "express";
import { MOCK_STRIPE_PRICES, MOCK_STRIPE_CUSTOMERS } from "./mock-stripe-data";

const app = express();

// Handle different content types
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For form-encoded data
app.use(express.raw({ type: "application/xml" })); // For S3 XML

// Authentication middleware for different services
function validateAuth(service: string) {
  return (req: Request, res: Response, next: any) => {
    const auth = req.headers.authorization;
    const apiKey = req.headers["x-api-key"];

    switch (service) {
      case "stripe":
        if (!auth || !auth.startsWith("Bearer sk_test_")) {
          return res.status(401).json({
            error: {
              code: "authentication_required",
              message: "Invalid API key provided",
              type: "invalid_request_error",
            },
          });
        }
        break;
      case "apollo":
        if (!apiKey) {
          return res.status(401).json({
            error: "API key required",
            message: "Missing X-Api-Key header",
          });
        }
        break;
      case "twilio":
        if (!auth || !auth.startsWith("Basic ")) {
          return res.status(401).json({
            code: 20003,
            message: "Authentication Error",
            status: 401,
          });
        }
        break;
      case "s3":
        if (
          !auth ||
          (!auth.includes("AWS4-HMAC-SHA256") && !auth.startsWith("Bearer"))
        ) {
          return res.status(403).type("application/xml").send(`
            <?xml version="1.0" encoding="UTF-8"?>
            <Error>
              <Code>AccessDenied</Code>
              <Message>Access Denied</Message>
              <Resource>${req.path}</Resource>
              <RequestId>mock_request_${Date.now()}</RequestId>
            </Error>
          `);
        }
        break;
    }
    next();
  };
}

// ===== SUPABASE MOCK ENDPOINTS =====
app.get("/mock/supabase/auth/v1/user", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers.apikey;

  if (!authHeader || !apiKey) {
    return res.status(401).json({
      error: "invalid_token",
      error_description: "JWT token is required",
    });
  }

  res.json({
    id: "user-uuid-mock-123",
    email: "test@example.com",
    role: "authenticated",
    user_metadata: {
      userId: "test_user_1",
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
});

app.post("/mock/supabase/auth/v1/token", (req: Request, res: Response) => {
  res.json({
    access_token: "mock_access_token_12345",
    token_type: "bearer",
    expires_in: 3600,
    refresh_token: "mock_refresh_token_67890",
    user: {
      id: "user-uuid-mock-123",
      email: "test@example.com",
    },
  });
});

// ===== UPSTASH REDIS MOCK ENDPOINTS =====
app.get("/mock/redis/GET/:key", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log(`📦 Mock Redis: GET ${req.params.key}`);

  if (req.params.key === "searchleads_subscription_tiers") {
    const { EXPECTED_SUBSCRIPTION_TIERS } = require("./mock-stripe-data");
    res.json({ result: JSON.stringify(EXPECTED_SUBSCRIPTION_TIERS) });
  } else {
    res.json({ result: null });
  }
});

app.get("/mock/redis/SETEX/:key/:ttl/:value", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log(`📦 Mock Redis: SETEX ${req.params.key} TTL:${req.params.ttl}`);
  res.json({ result: "OK" });
});

app.get("/mock/redis/SISMEMBER/:set/:member", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log(
    `📦 Mock Redis: SISMEMBER ${req.params.set}/${req.params.member}`
  );
  // Return 0 (not member) or 1 (is member) - Redis integers, not booleans
  res.json({ result: 0 }); // Event not processed
});

app.get("/mock/redis/SADD/:set/:member", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log(`📦 Mock Redis: SADD ${req.params.set}/${req.params.member}`);
  res.json({ result: 1 }); // Number of elements added
});

app.get("/mock/redis/EXPIRE/:key/:seconds", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log(`📦 Mock Redis: EXPIRE ${req.params.key} ${req.params.seconds}s`);
  res.json({ result: 1 }); // Key exists and expiration set
});

// ===== STRIPE API MOCK ENDPOINTS =====
app.get("/v1/prices", validateAuth("stripe"), (req: Request, res: Response) => {
  console.log("📊 Mock Stripe: Fetching prices...");
  res.json({
    object: "list",
    data: MOCK_STRIPE_PRICES,
    has_more: false,
    total_count: MOCK_STRIPE_PRICES.length,
    url: "/v1/prices",
  });
});

app.get(
  "/v1/customers",
  validateAuth("stripe"),
  (req: Request, res: Response) => {
    const email = req.query.email as string;
    console.log(`🔍 Mock Stripe: Finding customer by email: ${email}`);

    if (!email) {
      return res.status(400).json({
        error: {
          code: "parameter_missing",
          message: "Missing required parameter: email",
          param: "email",
          type: "invalid_request_error",
        },
      });
    }

    const customer = MOCK_STRIPE_CUSTOMERS[email];
    if (customer) {
      res.json({
        object: "list",
        data: [customer],
        has_more: false,
        total_count: 1,
        url: "/v1/customers",
      });
    } else {
      res.json({
        object: "list",
        data: [],
        has_more: false,
        total_count: 0,
        url: "/v1/customers",
      });
    }
  }
);

app.post(
  "/v1/customers",
  validateAuth("stripe"),
  (req: Request, res: Response) => {
    // Stripe expects form-encoded data
    const { name, email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: {
          code: "parameter_missing",
          message: "Missing required parameter: email",
          param: "email",
          type: "invalid_request_error",
        },
      });
    }

    console.log(`👤 Mock Stripe: Creating customer: ${email}`);

    const customerId = `cus_mock_${Date.now()}`;
    res.json({
      id: customerId,
      object: "customer",
      created: Math.floor(Date.now() / 1000),
      email: email,
      name: name || null,
      metadata: {},
      balance: 0,
      currency: "usd",
      delinquent: false,
      livemode: false,
    });
  }
);

app.post(
  "/v1/subscriptions",
  validateAuth("stripe"),
  (req: Request, res: Response) => {
    const { customer, items, metadata } = req.body;

    if (!customer) {
      return res.status(400).json({
        error: {
          code: "parameter_missing",
          message: "Missing required parameter: customer",
          param: "customer",
          type: "invalid_request_error",
        },
      });
    }

    console.log(
      `📋 Mock Stripe: Creating subscription for customer: ${customer}`
    );

    const subscriptionId = `sub_mock_${Date.now()}`;
    const currentTime = Math.floor(Date.now() / 1000);

    res.json({
      id: subscriptionId,
      object: "subscription",
      customer: customer,
      status: "incomplete",
      current_period_start: currentTime,
      current_period_end: currentTime + 30 * 24 * 60 * 60,
      created: currentTime,
      billing_cycle_anchor: currentTime,
      items: {
        object: "list",
        data: items || [],
        has_more: false,
        total_count: items ? items.length : 0,
      },
      metadata: metadata || {},
      latest_invoice: {
        id: `in_mock_${Date.now()}`,
        object: "invoice",
        payment_intent: {
          id: `pi_mock_${Date.now()}`,
          object: "payment_intent",
          client_secret: `pi_mock_${Date.now()}_secret_abc123`,
        },
      },
    });
  }
);

// ===== AWS S3 MOCK ENDPOINTS =====
app.post("/mock/s3/*", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  // Simulate authentication failure
  if (Math.random() < 0.1) {
    // 10% chance of auth failure for testing
    return res.status(403).type("application/xml").send(`
      <?xml version="1.0" encoding="UTF-8"?>
      <Error>
        <Code>AccessDenied</Code>
        <Message>Access Denied</Message>
        <Resource>${req.path}</Resource>
        <RequestId>mock_request_${Date.now()}</RequestId>
      </Error>
    `);
  }

  console.log("☁️ Mock S3 upload:", req.url);

  // Return S3-style success response with proper headers
  res.set({
    "x-amz-id-2": `mock_request_id_2_${Date.now()}`,
    "x-amz-request-id": `mock_request_${Date.now()}`,
    ETag: `"${Math.random().toString(36).substring(7)}"`,
    "x-amz-server-side-encryption": "AES256",
  });

  res.json({
    url: `http://localhost:3002/mock/s3/file_${Date.now()}.pdf`,
    bucket: "test-bucket",
    key: `file_${Date.now()}.pdf`,
    etag: `"${Math.random().toString(36).substring(7)}"`,
  });
});

// ===== TWILIO MOCK ENDPOINTS =====
app.post(
  "/mock/twilio/messages",
  validateAuth("twilio"),
  (req: Request, res: Response) => {
    console.log("📱 Mock Twilio: Sending message:", req.body);

    const { To, From, Body } = req.body;

    if (!To || !From || !Body) {
      return res.status(400).json({
        code: 21201,
        message: "No 'To' number is specified",
        status: 400,
      });
    }

    // Twilio response format
    res.json({
      account_sid: "ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      sid: `SM${Math.random().toString(36).substring(2, 15)}`,
      date_created: new Date().toISOString(),
      date_updated: new Date().toISOString(),
      date_sent: null,
      to: To,
      from: From,
      body: Body,
      status: "queued",
      num_segments: "1",
      direction: "outbound-api",
      error_code: null,
      error_message: null,
      price: null,
      price_unit: "USD",
      uri: `/2010-04-01/Accounts/ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/Messages/SM${Math.random()
        .toString(36)
        .substring(2, 15)}.json`,
    });
  }
);

// ===== APOLLO.IO MOCK ENDPOINTS =====
app.post(
  "/mock/automation",
  validateAuth("apollo"),
  (req: Request, res: Response) => {
    console.log("🤖 Mock Apollo automation called:", req.body);

    // Add Apollo.io rate limit headers
    res.set({
      "x-rate-limit-minute": "50",
      "x-rate-limit-hourly": "100",
      "x-rate-limit-daily": "300",
      "x-minute-usage": "5",
      "x-hourly-usage": "5",
      "x-daily-usage": "5",
    });

    res.json({
      record_id: "mock_" + Date.now(),
      status: "processing",
      message: "Lead enrichment started",
    });
  }
);

app.post(
  "/mock/status",
  validateAuth("apollo"),
  (req: Request, res: Response) => {
    console.log("📊 Mock Apollo status check:", req.body);

    res.set({
      "x-rate-limit-minute": "50",
      "x-rate-limit-hourly": "100",
      "x-rate-limit-daily": "300",
      "x-minute-usage": "6",
      "x-hourly-usage": "6",
      "x-daily-usage": "6",
    });

    res.json({
      record_id: req.body.record_id,
      enrichment_status: "Completed",
      enriched_records: 100,
      spreadsheet_url: "http://mock-sheet.com",
      apollo_link: "http://mock-apollo.com",
      credits_used: 100,
    });
  }
);

// ===== INVOICE GENERATION MOCK =====
app.post("/mock/invoice", (req: Request, res: Response) => {
  console.log("📄 Mock invoice generation:", req.body);

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing or invalid API key",
    });
  }

  res.json({
    id: `inv_mock_${Date.now()}`,
    invoice_url: "http://localhost:3002/mock/invoice.pdf",
    pdf_url: "http://localhost:3002/mock/invoice.pdf",
    status: "generated",
    amount: {
      amount: "123.45",
      code: "USD",
    },
    created_at: new Date().toISOString(),
  });
});

// ===== SUPABASE MOCK ENDPOINTS =====
app.get("/mock/supabase/auth/v1/user", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers.apikey;

  if (!authHeader || !apiKey) {
    return res.status(401).json({
      error: "invalid_token",
      error_description: "JWT token is required",
    });
  }

  res.json({
    id: "user-uuid-mock-123",
    email: "test@example.com",
    role: "authenticated",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
});

// ===== HEALTH CHECK =====
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "Mock services healthy",
    timestamp: new Date().toISOString(),
    services: {
      redis: "online",
      stripe: "online",
      s3: "online",
      twilio: "online",
      apollo: "online",
      invoice: "online",
      supabase: "online",
    },
  });
});

export function startMockServices(): Promise<void> {
  return new Promise((resolve) => {
    app.listen(3002, () => {
      console.log("🚀 Mock services running on port 3002");
      console.log("📊 Available endpoints:");
      console.log("  GET /v1/prices - Mock Stripe prices API");
      console.log("  GET /v1/customers - Mock Stripe customer search");
      console.log("  POST /v1/customers - Mock Stripe customer creation");
      console.log(
        "  POST /v1/subscriptions - Mock Stripe subscription creation"
      );
      console.log("  GET /mock/redis/* - Mock Redis operations");
      console.log("  POST /mock/s3/* - Mock S3 file uploads");
      console.log("  POST /mock/twilio/messages - Mock Twilio SMS");
      console.log("  POST /mock/automation - Mock Apollo.io automation");
      console.log("  POST /mock/status - Mock Apollo.io status");
      console.log("  POST /mock/invoice - Mock invoice generation");
      console.log("  GET /mock/supabase/* - Mock Supabase auth");
      resolve();
    });
  });
}

// Run if called directly
if (require.main === module) {
  startMockServices().catch(console.error);
}
