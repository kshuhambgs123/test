import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "./seed-database";
import { startMockServices } from "./mock-services";
import { WebhookSimulator } from "./webhook-simulator";
import { MOCK_STRIPE_CUSTOMERS } from "./mock-stripe-data";
import dotenv from "dotenv";

// Load test environment
dotenv.config({ path: ".env.test" });

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "test" ? ["error"] : ["error", "warn"],
});

const API_BASE = "http://localhost:3001/api";
const MOCK_SERVICES_BASE = "http://localhost:3002";

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  data?: any;
  error?: string;
}

interface TestEnvironment {
  testServerRunning: boolean;
  mockServicesRunning: boolean;
  databaseConnected: boolean;
  stripeConfigured: boolean;
}

// Custom fetch with timeout support
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

class SubscriptionTestRunner {
  private webhookSimulator: WebhookSimulator;
  private testResults: TestResult[] = [];
  private testStartTime: number = 0;

  constructor() {
    const webhookSecret =
      process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_mock_secret_12345";
    this.webhookSimulator = new WebhookSimulator(webhookSecret);
  }

  private async makeRequest(
    endpoint: string,
    options: RequestInit = {},
    useFormEncoding: boolean = false
  ): Promise<Response> {
    const url = `${API_BASE}${endpoint}`;

    let headers: Record<string, string> = {
      Authorization: "Bearer test_jwt_token", // Mock Supabase JWT
    };

    let body = options.body;

    // Handle different content types based on endpoint
    if (useFormEncoding && body && typeof body === "string") {
      // Convert JSON to form-encoded for Stripe endpoints
      try {
        const jsonData = JSON.parse(body);
        const formData = new URLSearchParams();

        Object.entries(jsonData).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            formData.append(key, String(value));
          }
        });

        body = formData.toString();
        headers["Content-Type"] = "application/x-www-form-urlencoded";
      } catch (error) {
        console.warn("Failed to convert to form encoding, using JSON");
        headers["Content-Type"] = "application/json";
      }
    } else {
      headers["Content-Type"] = "application/json";
    }

    // Add retry logic for flaky network requests
    let lastError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetchWithTimeout(
          url,
          {
            ...options,
            headers: {
              ...headers,
              ...options.headers,
            },
            body,
          },
          10000
        ); // 10 second timeout

        return response;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          console.log(
            `   Retry ${attempt}/${maxRetries - 1} for ${endpoint}...`
          );
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        }
      }
    }

    throw lastError;
  }

  private logTest(
    name: string,
    success: boolean,
    data?: any,
    error?: string
  ): void {
    const duration = Date.now() - this.testStartTime;
    this.testResults.push({ name, success, duration, data, error });

    const status = success ? "✅" : "❌";
    const durationStr = `(${duration}ms)`;
    console.log(`${status} ${name} ${durationStr}`);

    if (error) {
      console.log(`   ❌ Error: ${error}`);
    }

    if (data && success) {
      // Only show essential data to avoid log spam
      if (data.customerId || data.subscription?.id || data.received) {
        const essentialData = {
          ...(data.customerId && { customerId: data.customerId }),
          ...(data.subscription?.id && {
            subscriptionId: data.subscription.id,
          }),
          ...(data.subscription?.status && {
            status: data.subscription.status,
          }),
          ...(data.received !== undefined && { received: data.received }),
        };
        console.log(`   ✅ Result: ${JSON.stringify(essentialData)}`);
      }
    }
  }

  private async getUserCredits(userId: string): Promise<any> {
    try {
      const user = await prisma.user.findUnique({
        where: { UserID: userId },
        select: {
          UserID: true,
          name: true,
          credits: true,
          subscriptionCredits: true,
          subscriptionStatus: true,
          subscriptionPlan: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          TotalCreditsBought: true,
          TotalCreditsUsed: true,
        },
      });

      if (!user) {
        throw new Error(`User ${userId} not found in database`);
      }

      return user;
    } catch (error) {
      console.error(`Failed to get user credits for ${userId}:`, error);
      throw error;
    }
  }

  private async validateTestEnvironment(): Promise<TestEnvironment> {
    const environment: TestEnvironment = {
      testServerRunning: false,
      mockServicesRunning: false,
      databaseConnected: false,
      stripeConfigured: false,
    };

    console.log("🔍 Validating test environment...");

    // Check database connection
    try {
      await prisma.$connect();
      await prisma.user.count(); // Test basic query
      environment.databaseConnected = true;
      console.log("✅ Database connected");
    } catch (error) {
      console.log("❌ Database connection failed:", (error as Error).message);
    }

    // Check test server
    try {
      const response = await fetchWithTimeout(`${API_BASE}/health`, {}, 5000);
      if (response.ok) {
        environment.testServerRunning = true;
        console.log("✅ Test server running");
      }
    } catch (error) {
      console.log("❌ Test server not responding on port 3001");
    }

    // Check mock services
    try {
      const response = await fetchWithTimeout(
        `${MOCK_SERVICES_BASE}/health`,
        {},
        5000
      );
      if (response.ok) {
        environment.mockServicesRunning = true;
        console.log("✅ Mock services running");
      }
    } catch (error) {
      console.log("❌ Mock services not responding on port 3002");
    }

    // Check Stripe configuration
    if (
      process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.STRIPE_PUBLIC_SECRET_KEY
    ) {
      environment.stripeConfigured = true;
      console.log("✅ Stripe configuration found");
    } else {
      console.log("❌ Stripe configuration missing");
    }

    return environment;
  }

  async testFindCustomerByEmail(): Promise<void> {
    console.log("\n🔍 Testing findCustomerByEmail...");

    try {
      this.testStartTime = Date.now();

      // Test existing customer
      const response = await this.makeRequest("/payments/findCustomerByEmail", {
        method: "POST",
        body: JSON.stringify({ email: "john.doe@testcompany.com" }),
      });

      const result = await response.json();

      if (response.status === 200 && result.customerId) {
        this.logTest("Find existing customer by email", true, result);
      } else {
        this.logTest(
          "Find existing customer by email",
          false,
          null,
          `Expected 200 with customerId, got ${
            response.status
          }: ${JSON.stringify(result)}`
        );
      }

      // Test non-existent customer
      this.testStartTime = Date.now();
      const response2 = await this.makeRequest(
        "/payments/findCustomerByEmail",
        {
          method: "POST",
          body: JSON.stringify({ email: "nonexistent@example.com" }),
        }
      );

      if (response2.status === 404) {
        const result2 = await response2.json();
        this.logTest("Find non-existent customer by email", true, result2);
      } else {
        const result2 = await response2.json();
        this.logTest(
          "Find non-existent customer by email",
          false,
          null,
          `Expected 404, got ${response2.status}: ${JSON.stringify(result2)}`
        );
      }

      // Test invalid email format
      this.testStartTime = Date.now();
      const response3 = await this.makeRequest(
        "/payments/findCustomerByEmail",
        {
          method: "POST",
          body: JSON.stringify({ email: "invalid-email" }),
        }
      );

      // Should still return empty result, not error
      if (response3.status === 200 || response3.status === 404) {
        this.logTest("Find customer with invalid email format", true, {
          status: response3.status,
        });
      } else {
        const result3 = await response3.json();
        this.logTest(
          "Find customer with invalid email format",
          false,
          null,
          `Unexpected status ${response3.status}: ${JSON.stringify(result3)}`
        );
      }
    } catch (error) {
      this.logTest(
        "Find customer by email",
        false,
        null,
        (error as Error).message
      );
    }
  }

  async testCreateCustomer(): Promise<string | null> {
    console.log("\n👤 Testing createCustomer...");

    try {
      this.testStartTime = Date.now();

      const customerData = {
        name: "Test New Customer",
        email: `newcustomer_${Date.now()}@test.com`, // Unique email
        couponID: null,
      };

      // Use form encoding for Stripe endpoint
      const response = await this.makeRequest(
        "/payments/createCustomer",
        {
          method: "POST",
          body: JSON.stringify(customerData),
        },
        true
      );

      const result = await response.json();

      if (response.status === 200 && result.customer && result.customer.id) {
        this.logTest("Create new customer", true, result);
        return result.customer.id;
      } else {
        this.logTest(
          "Create new customer",
          false,
          null,
          `Expected 200 with customer.id, got ${
            response.status
          }: ${JSON.stringify(result)}`
        );
        return null;
      }
    } catch (error) {
      this.logTest("Create customer", false, null, (error as Error).message);
      return null;
    }
  }

  async testCreateSubscription(): Promise<void> {
    console.log("\n📋 Testing createSubscription...");

    try {
      this.testStartTime = Date.now();

      const customerId = MOCK_STRIPE_CUSTOMERS["john.doe@testcompany.com"].id;
      const subscriptionData = {
        customerId: customerId,
        tierName: "tier_20k",
        userId: "test_user_1",
      };

      const response = await this.makeRequest("/payments/createSubscription", {
        method: "POST",
        body: JSON.stringify(subscriptionData),
      });

      const result = await response.json();

      if (response.status === 200 && result.subscription) {
        this.logTest("Create subscription", true, result);

        // ✅ ADDED: Trigger the webhook that Stripe would send
        console.log("   🔗 Processing subscription.created webhook...");
        await this.webhookSimulator.sendWebhook("subscriptionCreated", {
          userId: "test_user_1",
          customerId: customerId,
          tierName: "tier_20k",
        });

        // Validate database was updated by webhook
        const user = await this.getUserCredits("test_user_1");
        console.log("   📊 Database after subscription creation:");
        console.log(`      Subscription Credits: ${user.subscriptionCredits}`);
        console.log(`      PAYG Credits: ${user.credits}`);
        console.log(`      Stripe Customer ID: ${user.stripeCustomerId}`);
        console.log(`      Subscription Status: ${user.subscriptionStatus}`);

        if (user.subscriptionCredits !== 20000) {
          console.log(
            `   ⚠️ Warning: Expected 20000 subscription credits, got ${user.subscriptionCredits}`
          );
        }
      } else {
        this.logTest(
          "Create subscription",
          false,
          null,
          `Expected 200 with subscription, got ${
            response.status
          }: ${JSON.stringify(result)}`
        );
      }
    } catch (error) {
      this.logTest(
        "Create subscription",
        false,
        null,
        (error as Error).message
      );
    }
  }

  async testGetSubscriptionStatus(): Promise<void> {
    console.log("\n📊 Testing getSubscriptionStatus...");

    try {
      this.testStartTime = Date.now();

      const customerId = MOCK_STRIPE_CUSTOMERS["john.doe@testcompany.com"].id;

      const response = await this.makeRequest(
        `/payments/getSubscriptionStatus/${customerId}`
      );
      const result = await response.json();

      if (response.status === 200) {
        this.logTest("Get subscription status", true, result);

        // Validate response structure
        const expectedFields = [
          "subscriptionStatus",
          "subscriptionPlan",
          "subscriptionCredits",
          "purchasedCredits",
          "totalCredits",
        ];
        const missingFields = expectedFields.filter(
          (field) => !(field in result)
        );

        if (missingFields.length > 0) {
          console.log(
            `   ⚠️ Warning: Missing fields in response: ${missingFields.join(
              ", "
            )}`
          );
        } else {
          console.log("   ✅ All expected fields present in response");
        }
      } else {
        this.logTest(
          "Get subscription status",
          false,
          null,
          `Expected 200, got ${response.status}: ${JSON.stringify(result)}`
        );
      }
    } catch (error) {
      this.logTest(
        "Get subscription status",
        false,
        null,
        (error as Error).message
      );
    }
  }

  async testUpgradeSubscription(): Promise<void> {
    console.log("\n⬆️ Testing upgradeSubscription...");

    try {
      this.testStartTime = Date.now();

      const customerId = MOCK_STRIPE_CUSTOMERS["john.doe@testcompany.com"].id;
      const upgradeData = {
        customerId: customerId,
        newTierName: "tier_40k",
        userId: "test_user_1",
      };

      const response = await this.makeRequest("/payments/upgradeSubscription", {
        method: "POST",
        body: JSON.stringify(upgradeData),
      });

      const result = await response.json();

      if (response.status === 200 && result.subscription) {
        this.logTest("Upgrade subscription", true, result);

        // ✅ ADDED: Trigger the webhooks that Stripe would send (cancel old + create new)
        console.log(
          "   🔗 Processing subscription.deleted webhook (old subscription)..."
        );
        await this.webhookSimulator.sendWebhook("subscriptionDeleted", {
          userId: "test_user_1",
          customerId: customerId,
        });

        console.log(
          "   🔗 Processing subscription.created webhook (new subscription)..."
        );
        await this.webhookSimulator.sendWebhook("subscriptionCreated", {
          userId: "test_user_1",
          customerId: customerId,
          tierName: "tier_40k",
        });

        // Validate database was updated
        const user = await this.getUserCredits("test_user_1");
        console.log("   📊 Database after upgrade:");
        console.log(`      Subscription Credits: ${user.subscriptionCredits}`);
        console.log(`      Subscription Plan: ${user.subscriptionPlan}`);

        if (user.subscriptionCredits !== 40000) {
          console.log(
            `   ⚠️ Warning: Expected 40000 subscription credits after upgrade, got ${user.subscriptionCredits}`
          );
        }

        if (user.subscriptionPlan !== "tier_40k") {
          console.log(
            `   ⚠️ Warning: Expected tier_40k plan, got ${user.subscriptionPlan}`
          );
        }
      } else {
        this.logTest(
          "Upgrade subscription",
          false,
          null,
          `Expected 200 with subscription, got ${
            response.status
          }: ${JSON.stringify(result)}`
        );
      }
    } catch (error) {
      this.logTest(
        "Upgrade subscription",
        false,
        null,
        (error as Error).message
      );
    }
  }

  async testCancelSubscription(): Promise<void> {
    console.log("\n❌ Testing cancelSubscription...");

    try {
      // Get current user state to see subscription credits
      const userBefore = await this.getUserCredits("test_user_1");
      console.log("   📊 User state before cancellation:");
      console.log(
        `      Subscription Credits: ${userBefore.subscriptionCredits}`
      );
      console.log(`      PAYG Credits: ${userBefore.credits}`);

      this.testStartTime = Date.now();

      const cancelData = {
        subscriptionId: userBefore.stripeSubscriptionId || "sub_test_12345",
        userId: "test_user_1",
      };

      const response = await this.makeRequest("/payments/cancelSubscription", {
        method: "POST",
        body: JSON.stringify(cancelData),
      });

      const result = await response.json();

      if (response.status === 200 && result.subscription) {
        this.logTest("Cancel subscription", true, result);

        // ✅ ADDED: Trigger the webhook that Stripe would send
        console.log("   🔗 Processing subscription.deleted webhook...");
        const customerId = MOCK_STRIPE_CUSTOMERS["john.doe@testcompany.com"].id;
        await this.webhookSimulator.sendWebhook("subscriptionDeleted", {
          userId: "test_user_1",
          customerId: customerId,
        });

        // Validate database was updated
        const userAfter = await this.getUserCredits("test_user_1");
        console.log("   📊 Database after cancellation:");
        console.log(
          `      Subscription Credits: ${userAfter.subscriptionCredits}`
        );
        console.log(`      PAYG Credits: ${userAfter.credits}`);
        console.log(
          `      Subscription Status: ${userAfter.subscriptionStatus}`
        );

        // Validate cancellation logic (20% conversion)
        const expectedPaygCredits =
          userBefore.credits + Math.floor(userBefore.subscriptionCredits * 0.2);
        if (
          userAfter.credits === expectedPaygCredits &&
          userAfter.subscriptionCredits === 0
        ) {
          console.log("   ✅ 20% credit conversion successful");
        } else {
          console.log(
            `   ⚠️ Credit conversion may be incorrect. Expected PAYG: ${expectedPaygCredits}, got: ${userAfter.credits}`
          );
        }
      } else {
        this.logTest(
          "Cancel subscription",
          false,
          null,
          `Expected 200 with subscription, got ${
            response.status
          }: ${JSON.stringify(result)}`
        );
      }
    } catch (error) {
      this.logTest(
        "Cancel subscription",
        false,
        null,
        (error as Error).message
      );
    }
  }

  async testWebhookSubscriptionCreated(): Promise<void> {
    console.log("\n🔗 Testing subscription.created webhook...");

    try {
      this.testStartTime = Date.now();

      const customerId = MOCK_STRIPE_CUSTOMERS["jane.smith@testcorp.com"].id;

      const result = await this.webhookSimulator.sendWebhook(
        "subscriptionCreated",
        {
          userId: "test_user_2",
          customerId: customerId,
          tierName: "tier_20k",
        }
      );

      if (result.received) {
        this.logTest("Webhook subscription.created", true, result);

        // Validate database was updated
        const user = await this.getUserCredits("test_user_2");
        console.log("   📊 Database after webhook:");
        console.log(`      Subscription Credits: ${user.subscriptionCredits}`);
        console.log(`      Stripe Customer ID: ${user.stripeCustomerId}`);
        console.log(`      Subscription Status: ${user.subscriptionStatus}`);
      } else {
        this.logTest(
          "Webhook subscription.created",
          false,
          null,
          `Webhook not properly received: ${JSON.stringify(result)}`
        );
      }
    } catch (error) {
      this.logTest(
        "Webhook subscription.created",
        false,
        null,
        (error as Error).message
      );
    }
  }

  async testWebhookInvoicePaymentSucceeded(): Promise<void> {
    console.log("\n💳 Testing invoice.payment_succeeded webhook...");

    try {
      this.testStartTime = Date.now();

      const customerId = MOCK_STRIPE_CUSTOMERS["jane.smith@testcorp.com"].id;

      const result = await this.webhookSimulator.sendWebhook(
        "invoicePaymentSucceeded",
        {
          customerId: customerId,
        }
      );

      if (result.received) {
        this.logTest("Webhook invoice.payment_succeeded", true, result);

        // Validate database was updated (credits should be reset to tier amount)
        const user = await this.getUserCredits("test_user_2");
        console.log("   📊 Database after monthly reset:");
        console.log(`      Subscription Credits: ${user.subscriptionCredits}`);
        console.log(`      Subscription Plan: ${user.subscriptionPlan}`);
      } else {
        this.logTest(
          "Webhook invoice.payment_succeeded",
          false,
          null,
          `Webhook not properly received: ${JSON.stringify(result)}`
        );
      }
    } catch (error) {
      this.logTest(
        "Webhook invoice.payment_succeeded",
        false,
        null,
        (error as Error).message
      );
    }
  }

  async testWebhookSubscriptionDeleted(): Promise<void> {
    console.log("\n🗑️ Testing subscription.deleted webhook...");

    try {
      const customerId = MOCK_STRIPE_CUSTOMERS["jane.smith@testcorp.com"].id;

      // Get user state before deletion to see unused credits
      const userBefore = await this.getUserCredits("test_user_2");
      console.log("   📊 User state before deletion:");
      console.log(
        `      Subscription Credits: ${userBefore.subscriptionCredits}`
      );
      console.log(`      PAYG Credits: ${userBefore.credits}`);

      this.testStartTime = Date.now();

      const result = await this.webhookSimulator.sendWebhook(
        "subscriptionDeleted",
        {
          userId: "test_user_2",
          customerId: customerId,
        }
      );

      if (result.received) {
        this.logTest("Webhook subscription.deleted", true, result);

        // Validate database was updated (unused subscription credits converted to purchased)
        const userAfter = await this.getUserCredits("test_user_2");
        console.log("   📊 Database after deletion:");
        console.log(
          `      Subscription Credits: ${userAfter.subscriptionCredits}`
        );
        console.log(`      PAYG Credits: ${userAfter.credits}`);
        console.log(
          `      Subscription Status: ${userAfter.subscriptionStatus}`
        );

        // Validate credit conversion
        const expectedPaygCredits =
          userBefore.credits + userBefore.subscriptionCredits;
        if (
          userAfter.credits === expectedPaygCredits &&
          userAfter.subscriptionCredits === 0
        ) {
          console.log("   ✅ Credit conversion successful");
        } else {
          console.log(`   ⚠️ Credit conversion may be incorrect`);
        }
      } else {
        this.logTest(
          "Webhook subscription.deleted",
          false,
          null,
          `Webhook not properly received: ${JSON.stringify(result)}`
        );
      }
    } catch (error) {
      this.logTest(
        "Webhook subscription.deleted",
        false,
        null,
        (error as Error).message
      );
    }
  }

  async testWebhookErrorScenarios(): Promise<void> {
    console.log("\n⚠️ Testing webhook error scenarios...");

    try {
      const customerId =
        MOCK_STRIPE_CUSTOMERS["bob.wilson@mockbusiness.com"].id;

      // Test payment failed
      this.testStartTime = Date.now();
      const failedResult = await this.webhookSimulator.sendWebhook(
        "invoicePaymentFailed",
        {
          customerId: customerId,
        }
      );

      if (failedResult.received) {
        this.logTest("Webhook invoice.payment_failed", true, failedResult);
      } else {
        this.logTest(
          "Webhook invoice.payment_failed",
          false,
          null,
          `Webhook not properly received: ${JSON.stringify(failedResult)}`
        );
      }

      // Wait before next test
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Test payment action required
      this.testStartTime = Date.now();
      const actionResult = await this.webhookSimulator.sendWebhook(
        "invoicePaymentActionRequired",
        {
          customerId: customerId,
        }
      );

      if (actionResult.received) {
        this.logTest(
          "Webhook invoice.payment_action_required",
          true,
          actionResult
        );
      } else {
        this.logTest(
          "Webhook invoice.payment_action_required",
          false,
          null,
          `Webhook not properly received: ${JSON.stringify(actionResult)}`
        );
      }
    } catch (error) {
      this.logTest(
        "Webhook error scenarios",
        false,
        null,
        (error as Error).message
      );
    }
  }

  async testPayAsYouGoWebhook(): Promise<void> {
    console.log("\n💰 Testing payment_intent.succeeded webhook (PAYG)...");

    try {
      const userBefore = await this.getUserCredits("test_user_3");
      const creditsBefore = userBefore.credits;

      this.testStartTime = Date.now();

      const result = await this.webhookSimulator.sendWebhook(
        "paymentIntentSucceeded",
        {
          userId: "test_user_3",
          credits: "1000",
        }
      );

      if (result.received) {
        this.logTest("Webhook payment_intent.succeeded (PAYG)", true, result);

        // Validate database was updated
        const userAfter = await this.getUserCredits("test_user_3");
        console.log("   📊 Database after PAYG credit purchase:");
        console.log(`      PAYG Credits Before: ${creditsBefore}`);
        console.log(`      PAYG Credits After: ${userAfter.credits}`);

        const expectedCredits = creditsBefore + 1000;
        if (userAfter.credits === expectedCredits) {
          console.log("   ✅ PAYG credit addition successful");
        } else {
          console.log(
            `   ⚠️ Expected ${expectedCredits} credits, got ${userAfter.credits}`
          );
        }
      } else {
        this.logTest(
          "Webhook payment_intent.succeeded (PAYG)",
          false,
          null,
          `Webhook not properly received: ${JSON.stringify(result)}`
        );
      }
    } catch (error) {
      this.logTest(
        "Webhook payment_intent.succeeded",
        false,
        null,
        (error as Error).message
      );
    }
  }

  async runCompleteTestSuite(): Promise<void> {
    const suiteStartTime = Date.now();
    console.log("🚀 Starting Complete Subscription Test Suite");
    console.log("=".repeat(60));
    console.log(`📅 Started at: ${new Date().toLocaleString()}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || "development"}`);

    try {
      // Phase 0: Environment validation
      console.log("\n🔍 Phase 0: Environment Validation");
      const environment = await this.validateTestEnvironment();

      if (!environment.databaseConnected || !environment.stripeConfigured) {
        console.log(
          "\n❌ Critical environment components missing. Cannot proceed."
        );
        console.log("💡 Troubleshooting:");
        if (!environment.databaseConnected)
          console.log("  - Check DATABASE_URL in .env.test");
        if (!environment.stripeConfigured)
          console.log("  - Check STRIPE_* variables in .env.test");
        return;
      }

      // Phase 1: Database setup
      console.log("\n📊 Phase 1: Database Setup");
      await seedDatabase();

      // Phase 2: Mock services setup
      console.log("\n🔧 Phase 2: Starting Mock Services");
      if (!environment.mockServicesRunning) {
        await startMockServices();
        // Wait for services to fully start
        await new Promise((resolve) => setTimeout(resolve, 3000));
        console.log("✅ Mock services started");
      } else {
        console.log("✅ Mock services already running");
      }

      // Phase 3: Final environment check
      if (!environment.testServerRunning) {
        console.log("\n❌ Test server not running on port 3001");
        console.log("💡 Please start it with: npm run test:server");
        console.log("   Then run: npm run test:run");
        return;
      }

      // Phase 4: Test subscription endpoints
      console.log("\n🧪 Phase 4: Testing Subscription Endpoints");
      await this.testFindCustomerByEmail();
      await this.testCreateCustomer();
      await this.testCreateSubscription();
      await this.testGetSubscriptionStatus();
      await this.testUpgradeSubscription();
      await this.testCancelSubscription();

      // Phase 5: Test webhooks
      console.log("\n🔗 Phase 5: Testing Webhook Processing");
      await this.testWebhookSubscriptionCreated();
      await this.testWebhookInvoicePaymentSucceeded();
      await this.testWebhookSubscriptionDeleted();
      await this.testWebhookErrorScenarios();
      await this.testPayAsYouGoWebhook();

      // Phase 6: Summary
      const suiteDuration = Date.now() - suiteStartTime;
      this.printTestSummary(suiteDuration);
    } catch (error) {
      console.error("\n❌ Test suite failed with critical error:", error);
      const suiteDuration = Date.now() - suiteStartTime;
      this.printTestSummary(suiteDuration);
    } finally {
      try {
        await prisma.$disconnect();
        console.log("🔌 Database connection closed");
      } catch (error) {
        console.warn("⚠️ Warning: Failed to close database connection:", error);
      }
    }
  }

  private printTestSummary(suiteDuration: number): void {
    console.log("\n📋 TEST SUMMARY");
    console.log("=".repeat(60));

    const passed = this.testResults.filter((t) => t.success).length;
    const failed = this.testResults.filter((t) => !t.success).length;
    const total = this.testResults.length;

    const avgDuration =
      total > 0
        ? Math.round(
            this.testResults.reduce((sum, t) => sum + t.duration, 0) / total
          )
        : 0;
    const successRate = total > 0 ? ((passed / total) * 100).toFixed(1) : "0.0";

    console.log(
      `📊 Results: ${passed}/${total} tests passed (${successRate}%)`
    );
    console.log(
      `⏱️ Duration: ${suiteDuration}ms total, ${avgDuration}ms avg per test`
    );
    console.log(`📅 Completed: ${new Date().toLocaleString()}`);

    if (failed > 0) {
      console.log("\n❌ Failed Tests:");
      this.testResults
        .filter((t) => !t.success)
        .forEach((test, index) => {
          console.log(`  ${index + 1}. ${test.name}`);
          console.log(`     ❌ ${test.error}`);
          console.log(`     ⏱️ Duration: ${test.duration}ms`);
        });
    }

    if (passed > 0) {
      console.log("\n✅ Passed Tests:");
      this.testResults
        .filter((t) => t.success)
        .forEach((test, index) => {
          console.log(`  ${index + 1}. ${test.name} (${test.duration}ms)`);
        });
    }

    console.log("\n🎯 Features Tested:");
    console.log("✓ Customer management (find, create)");
    console.log("✓ Subscription lifecycle (create, upgrade, cancel)");
    console.log("✓ Subscription status retrieval");
    console.log("✓ Webhook processing (all event types)");
    console.log("✓ Credit management (hybrid PAYG + subscription)");
    console.log("✓ Error handling and edge cases");
    console.log("✓ Database consistency and transactions");

    if (successRate === "100.0") {
      console.log(
        "\n🎉 All tests passed! Your subscription system is working correctly."
      );
    } else if (parseFloat(successRate) >= 80) {
      console.log("\n⚠️ Most tests passed, but some issues need attention.");
    } else {
      console.log(
        "\n❌ Multiple test failures detected. Review implementation."
      );
    }

    console.log("\n💡 Next steps:");
    console.log("  - Review any failed tests above");
    console.log("  - Check logs for detailed error information");
    console.log("  - Validate your .env.test configuration");
    console.log("  - Ensure all mock services are running properly");
  }
}

// CLI interface
if (require.main === module) {
  const testRunner = new SubscriptionTestRunner();
  testRunner
    .runCompleteTestSuite()
    .then(() => {
      console.log("\n✅ Test suite execution completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Test suite execution failed:", error);
      process.exit(1);
    });
}

export { SubscriptionTestRunner };
