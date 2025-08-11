import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

// Load test environment
dotenv.config({ path: ".env.test" });

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === "test" ? ["error"] : ["error", "warn"],
});

interface TestUser {
  UserID: string;
  name: string;
  email: string;
  companyName: string;
  phoneNumber: string;
  location: string;
  credits: number;
  subscriptionCredits: number;
  heardFrom: string;
  apikey: string;
  TotalCreditsBought: number;
  TotalCreditsUsed: number;
}

const testUsers: TestUser[] = [
  {
    UserID: "test_user_1",
    name: "John Doe",
    email: "john.doe@testcompany.com",
    companyName: "Test Company Inc",
    phoneNumber: "+1-555-0101",
    location: "New York, NY",
    credits: 100, // PAYG credits
    subscriptionCredits: 0, // No subscription yet
    heardFrom: "Google Search",
    apikey: "sk_test_api_key_user_1_abc123",
    TotalCreditsBought: 100,
    TotalCreditsUsed: 0,
  },
  {
    UserID: "test_user_2",
    name: "Jane Smith",
    email: "jane.smith@testcorp.com",
    companyName: "Test Corp LLC",
    phoneNumber: "+1-555-0102",
    location: "San Francisco, CA",
    credits: 0, // No PAYG credits
    subscriptionCredits: 0, // No subscription yet
    heardFrom: "Referral",
    apikey: "sk_test_api_key_user_2_def456",
    TotalCreditsBought: 0,
    TotalCreditsUsed: 0,
  },
  {
    UserID: "test_user_3",
    name: "Bob Wilson",
    email: "bob.wilson@mockbusiness.com",
    companyName: "Mock Business Solutions",
    phoneNumber: "+1-555-0103",
    location: "Austin, TX",
    credits: 500,
    subscriptionCredits: 0,
    heardFrom: "LinkedIn",
    apikey: "sk_test_api_key_user_3_ghi789",
    TotalCreditsBought: 500,
    TotalCreditsUsed: 50,
  },
  {
    UserID: "test_user_4",
    name: "Alice Johnson",
    email: "alice.johnson@demotech.com",
    companyName: "Demo Tech Startups",
    phoneNumber: "+1-555-0104",
    location: "Seattle, WA",
    credits: 250,
    subscriptionCredits: 0,
    heardFrom: "Twitter",
    apikey: "sk_test_api_key_user_4_jkl012",
    TotalCreditsBought: 250,
    TotalCreditsUsed: 0,
  },
  {
    UserID: "test_user_5",
    name: "Charlie Brown",
    email: "charlie.brown@sampleinc.com",
    companyName: "Sample Inc",
    phoneNumber: "+1-555-0105",
    location: "Boston, MA",
    credits: 0,
    subscriptionCredits: 0,
    heardFrom: "Blog Post",
    apikey: "sk_test_api_key_user_5_mno345",
    TotalCreditsBought: 0,
    TotalCreditsUsed: 0,
  },
];

async function validateDatabaseConnection(): Promise<void> {
  try {
    await prisma.$connect();
    console.log("✅ Database connection established");
  } catch (error) {
    console.error("❌ Failed to connect to database:", error);
    throw new Error(
      "Database connection failed. Please check your DATABASE_URL in .env.test"
    );
  }
}

async function clearTestData(): Promise<void> {
  try {
    console.log("🧹 Clearing existing test data...");

    // Use transaction for atomic cleanup
    await prisma.$transaction(async (tx) => {
      // Delete in order to respect foreign key constraints
      await tx.logs.deleteMany({
        where: { userID: { startsWith: "test_user_" } },
      });

      await tx.billingDetails.deleteMany({
        where: { userID: { startsWith: "test_user_" } },
      });

      await tx.user.deleteMany({
        where: { UserID: { startsWith: "test_user_" } },
      });

      // Clean up test admin
      await tx.admin.deleteMany({
        where: { email: { endsWith: "@test.com" } },
      });
    });

    console.log("✅ Test data cleared successfully");
  } catch (error) {
    console.error("❌ Failed to clear test data:", error);
    throw error;
  }
}

async function createTestUsers(): Promise<void> {
  try {
    console.log("👥 Creating test users...");

    // Use transaction for atomic user creation
    await prisma.$transaction(async (tx) => {
      for (const userData of testUsers) {
        const user = await tx.user.create({
          data: {
            ...userData,
            date: new Date(),
            // Subscription fields initially null for clean testing
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            subscriptionStatus: null,
            subscriptionCurrentPeriodEnd: null,
            subscriptionPlan: null,
          },
        });
        console.log(`✅ Created user: ${user.name} (${user.email})`);
      }
    });

    console.log(`✅ Successfully created ${testUsers.length} test users`);
  } catch (error) {
    console.error("❌ Failed to create test users:", error);
    throw error;
  }
}

async function createTestAdmin(): Promise<void> {
  try {
    console.log("👤 Creating test admin...");

    const admin = await prisma.admin.upsert({
      where: { email: "admin@test.com" },
      update: {
        password: "test123", // Update password in case it changed
      },
      create: {
        email: "admin@test.com",
        password: "test123",
      },
    });

    console.log("✅ Created test admin:", admin.email);
  } catch (error) {
    console.error("❌ Failed to create test admin:", error);
    throw error;
  }
}

async function validateSeededData(): Promise<void> {
  try {
    console.log("🔍 Validating seeded data...");

    // Check if all users were created
    const userCount = await prisma.user.count({
      where: { UserID: { startsWith: "test_user_" } },
    });

    if (userCount !== testUsers.length) {
      throw new Error(
        `Expected ${testUsers.length} users, but found ${userCount}`
      );
    }

    // Check if admin was created
    const adminCount = await prisma.admin.count({
      where: { email: "admin@test.com" },
    });

    if (adminCount !== 1) {
      throw new Error(`Expected 1 admin, but found ${adminCount}`);
    }

    // Validate API keys are unique
    const apiKeys = await prisma.user.findMany({
      where: { UserID: { startsWith: "test_user_" } },
      select: { apikey: true },
    });

    const uniqueApiKeys = new Set(apiKeys.map((u) => u.apikey));
    if (uniqueApiKeys.size !== apiKeys.length) {
      throw new Error("Duplicate API keys found in test data");
    }

    console.log("✅ Data validation passed");
  } catch (error) {
    console.error("❌ Data validation failed:", error);
    throw error;
  }
}

export async function seedDatabase(): Promise<void> {
  const startTime = Date.now();

  try {
    console.log("🌱 Starting database seeding for test environment...");
    console.log(`📍 Environment: ${process.env.NODE_ENV}`);
    console.log(
      `🗄️ Database: ${process.env.DATABASE_URL?.split("@")[1] || "Unknown"}`
    );

    // Validate we're in test environment
    if (process.env.NODE_ENV !== "test") {
      console.warn("⚠️ Warning: Not running in test environment!");
      console.log("Current NODE_ENV:", process.env.NODE_ENV);
    }

    // Step 1: Validate database connection
    await validateDatabaseConnection();

    // Step 2: Clear existing test data
    await clearTestData();

    // Step 3: Create test users
    await createTestUsers();

    // Step 4: Create test admin
    await createTestAdmin();

    // Step 5: Validate seeded data
    await validateSeededData();

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log("\n📊 Seeding Complete - Summary:");
    console.log("━".repeat(50));
    console.log(`✅ ${testUsers.length} test users created`);
    console.log("✅ 1 test admin created");
    console.log("✅ All API keys are unique");
    console.log("✅ Clean slate: No active subscriptions");
    console.log(`⏱️ Completed in ${duration}ms`);
    console.log("━".repeat(50));

    console.log("\n📋 Test Users Summary:");
    testUsers.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.name} (${user.email})`);
      console.log(`     💳 PAYG Credits: ${user.credits}`);
      console.log(`     🔑 API Key: ${user.apikey}`);
      console.log(
        `     📊 Credits Used: ${user.TotalCreditsUsed}/${user.TotalCreditsBought}`
      );
    });

    console.log("\n🚀 Database is ready for testing!");
  } catch (error) {
    console.error("\n❌ Database seeding failed!");
    console.error("Error details:", error);
    console.log("\n🔧 Troubleshooting tips:");
    console.log(
      "1. Check your .env.test file exists and has correct DATABASE_URL"
    );
    console.log("2. Ensure database is running and accessible");
    console.log("3. Run 'npx prisma db push' to ensure schema is up to date");
    console.log("4. Check database permissions");
    throw error;
  } finally {
    try {
      await prisma.$disconnect();
      console.log("🔌 Database connection closed");
    } catch (disconnectError) {
      console.warn(
        "⚠️ Warning: Failed to disconnect from database:",
        disconnectError
      );
    }
  }
}

export async function resetDatabase(): Promise<void> {
  console.log("🔄 Resetting database for fresh test run...");
  await seedDatabase();
}

export async function getTestUser(
  userNumber: 1 | 2 | 3 | 4 | 5
): Promise<TestUser> {
  const user = testUsers[userNumber - 1];
  if (!user) {
    throw new Error(`Test user ${userNumber} not found. Available users: 1-5`);
  }
  return user;
}

export async function getTestUserByEmail(
  email: string
): Promise<TestUser | undefined> {
  return testUsers.find((user) => user.email === email);
}

export { testUsers };

// Run if called directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log("✅ Seeding completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Seeding failed:", error);
      process.exit(1);
    });
}
