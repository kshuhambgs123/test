process.env.NODE_ENV = "test";
process.env.SUPABASE_URL = "https://mock-project-12345.supabase.co";
process.env.SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vY2stcHJvamVjdCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQwOTk1MjAwLCJleHAiOjE5NTYzNzEyMDB9.rJ8Jvekw7uX9V2s4T6P8L5N3M9K1F7E2D4C6B8A0Z9Y8X7W6V5U4T3S2R1Q0P9O8";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vY2stcHJvamVjdCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2NDA5OTUyMDAsImV4cCI6MTk1NjM3MTIwMH0.mock_service_role_signature_here_12345";

const Module = require("module");
const originalRequire = Module.prototype.require;

Module.prototype.require = function (...args: any[]) {
  if (args[0] === "@supabase/supabase-js") {
    return {
      createClient: (url: string, key: string) => {
        console.log(`✅ Intercepted Supabase createClient call: ${url}`);
        return require("./mock-supabase-client").mockSupabaseClient;
      },
    };
  }
  return originalRequire.apply(this, args);
};

import express, { Request, Response, NextFunction, Router } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { mockStripeClient } from "./mock-stripe-client";

// Load test environment first
dotenv.config({ path: ".env.test" });

const app = express();

// Environment validation
function validateEnvironment(): void {
  const requiredVars = [
    "DATABASE_URL",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PUBLIC_SECRET_KEY",
  ];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error("❌ Missing required environment variables:");
    missingVars.forEach((varName) => {
      console.error(`   - ${varName}`);
    });
    console.error("💡 Check your .env.test file");
    process.exit(1);
  }

  console.log("✅ Environment variables validated");
  console.log(`✅ Supabase URL: ${process.env.SUPABASE_URL}`);
}

// Request logging middleware for debugging
function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  // Log request
  console.log(`📥 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(
      `   Body: ${JSON.stringify(req.body, null, 2).substring(0, 500)}`
    );
  }
  if (req.headers["stripe-signature"]) {
    console.log(
      `   Stripe-Signature: ${req.headers["stripe-signature"]
        ?.toString()
        .substring(0, 50)}...`
    );
  }

  // Log response
  const originalSend = res.send;
  res.send = function (body) {
    const duration = Date.now() - start;
    console.log(
      `📤 ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
    );
    return originalSend.call(this, body);
  };

  next();
}

// Error handling middleware
function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error("❌ Server Error:", err);
  console.error("Stack:", err.stack);

  res.status(500).json({
    error: "Internal Server Error",
    message:
      process.env.NODE_ENV === "test" ? err.message : "Something went wrong",
    timestamp: new Date().toISOString(),
  });
}

function injectMockClients(): void {
  try {
    // Mock Stripe client
    const stripeModulePath = require.resolve("../payments/stripe");
    if (require.cache[stripeModulePath]) {
      const stripeModule = require.cache[stripeModulePath];
      if (stripeModule && stripeModule.exports) {
        stripeModule.exports.stripeClient = mockStripeClient;
        console.log("✅ Mock Stripe client injected via module cache");
      }
    } else {
      const stripeModule = require("../payments/stripe");
      if (stripeModule) {
        stripeModule.stripeClient = mockStripeClient;
        console.log("✅ Mock Stripe client injected via direct require");
      }
    }

    // Mock Supabase client - inject before any imports
    const { createClient } = require("./mock-supabase-client");

    // Method 1: Mock the @supabase/supabase-js module
    const supabaseModule =
      require.cache[require.resolve("@supabase/supabase-js")];
    if (supabaseModule) {
      supabaseModule.exports.createClient = createClient;
      console.log("✅ Mock Supabase client injected via module cache");
    }

    // Method 2: Set global mock
    (global as any).mockSupabaseCreateClient = createClient;

    // Method 3: Patch any existing Supabase initialization files
    try {
      // Look for common Supabase initialization patterns
      const initFiles = [
        "../middleware/supabaseAuth",
        "../db/index",
        "../utils/supabase",
      ];

      for (const file of initFiles) {
        try {
          const filePath = require.resolve(file);
          if (require.cache[filePath]) {
            const module = require.cache[filePath];
            if (module && module.exports && module.exports.supabase) {
              module.exports.supabase =
                require("./mock-supabase-client").mockSupabaseClient;
              console.log(`✅ Mock Supabase client injected into ${file}`);
            }
          }
        } catch (e) {
          // File doesn't exist, continue
        }
      }
    } catch (error) {
      console.log("⚠️ Could not patch Supabase initialization files");
    }

    console.log("✅ Mock clients injection completed");
  } catch (error) {
    console.warn("⚠️ Failed to inject mock clients:", (error as Error).message);
    console.warn("   Tests may use real clients");
  }
}

// Enhanced authentication middleware
function mockAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip auth for webhook endpoint (Stripe handles this)
  if (req.path === "/searchLeadsConfirmPayment") {
    return next();
  }

  // Skip auth for health check
  if (req.path === "/health") {
    return next();
  }

  // Extract test user from Authorization header or use default
  let testUserId = "test_user_1";
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    // Extract user ID from mock JWT token if present
    if (token.includes("test_user_")) {
      const match = token.match(/test_user_\d+/);
      if (match) {
        testUserId = match[0];
      }
    }
  }

  // Mock Supabase user object
  (req as any).user = {
    id: `${testUserId}_auth`, // Supabase format
    user_metadata: {
      userId: testUserId, // Your custom user ID
    },
    email: `${testUserId}@testcompany.com`,
    aud: "authenticated",
    role: "authenticated",
  };

  console.log(`🔐 Mock auth: ${testUserId} (${(req as any).user.email})`);
  next();
}

// Middleware setup
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
  })
);

// Add request logging
if (process.env.NODE_ENV === "test") {
  app.use(requestLogger);
}

// Special webhook handling (must be before regular JSON parser)
app.use(
  "/api/payments/searchLeadsConfirmPayment",
  bodyParser.raw({
    type: "application/json",
    limit: "1mb",
  })
);

// Regular JSON parsing for other routes
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

// Form-encoded parsing for Stripe endpoints
app.use("/api/payments", bodyParser.urlencoded({ extended: true }));

// Mock authentication
app.use("/api/payments", mockAuthMiddleware);

// Import and use payment routes with proper typing
let paymentsRoutes: Router | null = null;
let routesLoaded = false;

try {
  const routesModule = require("../routes/payments");
  paymentsRoutes = routesModule.default || routesModule;

  if (!paymentsRoutes) {
    throw new Error("Payment routes not found or not exported correctly");
  }

  app.use("/api/payments", paymentsRoutes);
  routesLoaded = true;
  console.log("✅ Payment routes loaded successfully");
} catch (error) {
  console.error("❌ Failed to load payment routes:", (error as Error).message);
  console.error(
    "💡 Check that ../routes/payments exists and exports routes correctly"
  );

  // Create minimal fallback routes for testing
  app.use("/api/payments", (req: Request, res: Response) => {
    res.status(503).json({
      error: "Payment routes not available",
      message: "Could not load payment routes module",
      endpoint: req.path,
      method: req.method,
    });
  });
}

// Health check endpoint (for test runner)
app.get("/api/health", (req: Request, res: Response) => {
  const healthData = {
    status: "healthy",
    message: "Test server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    port: process.env.PORT || 3001,
    database: process.env.DATABASE_URL ? "configured" : "not configured",
    stripe: {
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
        ? "configured"
        : "missing",
      publicKey: process.env.STRIPE_PUBLIC_SECRET_KEY
        ? "configured"
        : "missing",
      client: "mock",
    },
    routes: {
      payments: routesLoaded ? "loaded" : "failed",
    },
  };

  res.status(200).json(healthData);
});

// Root health check (redirect)
app.get("/health", (req: Request, res: Response) => {
  res.redirect("/api/health");
});

// Test endpoint to verify mock Stripe
app.get("/api/test/stripe", async (req: Request, res: Response) => {
  try {
    const prices = await mockStripeClient.prices.list({});
    res.json({
      message: "Mock Stripe client working",
      pricesCount: prices.data.length,
      samplePrice: prices.data[0]?.id || "none",
    });
  } catch (error) {
    res.status(500).json({
      error: "Mock Stripe client failed",
      message: (error as Error).message,
    });
  }
});

// Catch-all for 404s
app.use("*", (req: Request, res: Response) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableRoutes: [
      "GET /health",
      "GET /api/test/stripe",
      "POST /api/payments/findCustomerByEmail",
      "POST /api/payments/createCustomer",
      "POST /api/payments/createSubscription",
      "GET /api/payments/getSubscriptionStatus/:customerId",
      "POST /api/payments/upgradeSubscription",
      "POST /api/payments/cancelSubscription",
      "POST /api/payments/searchLeadsConfirmPayment",
    ],
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Server startup
async function startServer(): Promise<void> {
  try {
    // Validate environment
    validateEnvironment();

    // Inject mock clients
    injectMockClients();

    const PORT = process.env.PORT || 3001;

    const server = app.listen(PORT, () => {
      console.log("\n🚀 Test Server Started Successfully!");
      console.log("=".repeat(50));
      console.log(`📡 Server: http://localhost:${PORT}`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(
        `🗄️ Database: ${
          process.env.DATABASE_URL ? "Connected" : "Not configured"
        }`
      );
      console.log(`🔑 Stripe: Mock client active`);
      console.log(
        `📋 Routes: Payment routes ${routesLoaded ? "loaded" : "failed"}`
      );
      console.log("=".repeat(50));
      console.log("✅ Ready for testing!");
    });

    // Graceful shutdown handling
    process.on("SIGTERM", () => {
      console.log("\n📴 SIGTERM received, shutting down gracefully...");
      server.close(() => {
        console.log("✅ Test server closed");
        process.exit(0);
      });
    });

    process.on("SIGINT", () => {
      console.log("\n📴 SIGINT received, shutting down gracefully...");
      server.close(() => {
        console.log("✅ Test server closed");
        process.exit(0);
      });
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
      // Don't crash in test environment, just log
    });
  } catch (error) {
    console.error("❌ Failed to start test server:", error);
    process.exit(1);
  }
}

// Start the server
if (require.main === module) {
  startServer().catch((error) => {
    console.error("❌ Server startup failed:", error);
    process.exit(1);
  });
}

export default app;
export { startServer };
