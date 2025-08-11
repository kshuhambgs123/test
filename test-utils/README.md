# 📁 Test-Utils Directory Overview

This directory creates a complete isolated testing environment that simulates your entire production stack locally, allowing you to test your subscription system without touching real services, real money, or real customer data.

# 1. mock-services.ts

**Purpose**: This file creates a comprehensive mock server that replaces ALL external services your application depends on during testing. Think of it as a "fake internet" for your tests.
What it does: It spins up an Express server on port 3002 that mimics the exact API behavior of Stripe (customer creation, subscription management), Redis (caching), AWS S3 (file uploads), Twilio (SMS), Apollo.io (lead enrichment), invoice generation services, and Supabase (authentication). Each mock endpoint returns realistic responses with proper HTTP status codes, headers, and data structures that match the real services exactly.

**Role in bigger picture**: This is the foundation that makes testing possible without external dependencies. When your application tries to call Stripe's API or upload to S3, it hits these mock endpoints instead, giving you predictable, controllable responses. This means you can test payment failures, network timeouts, and edge cases without actually failing real payments or depending on external service availability.

# 2. mock-stripe-client.ts

**Purpose**: This file provides a drop-in replacement for the actual Stripe JavaScript SDK that your application code uses. Instead of making real HTTP requests to Stripe's servers, it returns mock data locally.
What it does: It implements the exact same interface as the real Stripe client (stripe.customers.create(), stripe.subscriptions.cancel(), etc.) but processes everything locally using the mock data. It includes proper webhook signature verification, error handling for invalid requests, and realistic response objects with all the fields Stripe would normally return.

**Role in bigger picture**: This allows your application code to run unchanged during testing. Your payment routes and business logic can call stripe.customers.create() exactly as they would in production, but instead of charging real credit cards or creating real Stripe customers, everything happens in memory with fake data. This enables safe testing of subscription flows, payment processing, and error scenarios.

# 3. mock-stripe-data.ts

**Purpose**: This file contains a curated dataset of realistic Stripe objects (customers, products, prices, subscriptions) that serve as the "fake database" for your mock Stripe services.
What it does: It defines TypeScript interfaces that exactly match Stripe's API response format and provides sample data for different subscription tiers (10k, 20k, 30k, 40k, 50k credits), test customers with known email addresses, and pricing information. This data is structured to support all your test scenarios - upgrades, downgrades, cancellations, and edge cases.

**Role in bigger picture**: This is the "source of truth" for all test data. When you test finding a customer by email, upgrading a subscription, or processing webhooks, the mock services use this data to provide consistent, predictable responses. It ensures that all your test files are working with the same baseline data, making tests repeatable and debugging easier.

# 4. seed-database.ts

**Purpose**: This file sets up your test database with a clean, known state before each test run, essentially creating a "laboratory environment" with controlled conditions.
What it does: It creates 5 test users with different credit balances, subscription states, and API keys, along with a test admin account. It handles database cleanup (removing old test data), user creation with proper relationships, data validation, and provides utility functions for accessing test users. It also includes comprehensive error handling and troubleshooting guidance.

**Role in bigger picture**: This ensures every test starts from a clean slate with predictable data. Instead of tests potentially interfering with each other or depending on leftover data from previous runs, each test suite begins with exactly 5 users in known states. This makes tests reliable and allows you to verify that your subscription operations (credits, status changes, etc.) work correctly by comparing before/after database states.

# 5. test-runner.ts

**Purpose**: This is the orchestrator that ties everything together - it's like a quality assurance manager that systematically tests every aspect of your subscription system and reports the results.
What it does: It runs a comprehensive test suite that validates your entire subscription workflow: finding customers, creating subscriptions, processing upgrades/downgrades, handling cancellations, processing webhooks, and managing the hybrid credit system (subscription + pay-as-you-go). It includes environment validation, retry logic for flaky network calls, detailed logging, performance metrics, and generates comprehensive pass/fail reports with troubleshooting guidance.

**Role in bigger picture**: This is your main testing interface. When you run npm test, this file coordinates everything: it seeds the database, starts mock services, validates your API endpoints, simulates webhook events, and verifies that your database is updated correctly. It acts as both a test runner and a debugging tool, showing you exactly what's working and what needs attention in your subscription system.

# 6. test-server.ts

**Purpose**: This file creates a test version of your actual API server that runs in isolation with all external dependencies replaced by mocks.
What it does: It starts an Express server on port 3001 that loads your real payment routes and business logic, but injects the mock Stripe client instead of the real one. It includes mock authentication (bypassing Supabase), request/response logging for debugging, enhanced error handling, and special middleware for webhook processing. It validates environment variables and provides detailed health checks.

**Role in bigger picture**: This bridges the gap between your real application code and the testing environment. Your actual payment routes run exactly as they would in production, but all external calls are intercepted and handled by mocks. This lets you test the real logic, error handling, and data flow of your application without touching production services. The test-runner makes HTTP requests to this server just like a real frontend would.

# 7. webhook-simulator.ts

**Purpose**: This file simulates Stripe's webhook system, which is how Stripe notifies your application about events like successful payments, failed charges, or subscription changes.
What it does: It creates properly formatted webhook events (subscription.created, invoice.payment_succeeded, etc.) with exact Stripe payload structures, generates cryptographic signatures that match Stripe's security model, and sends them to your webhook endpoint. It includes timestamp validation, proper error handling, and can simulate complete subscription lifecycle flows and error scenarios.

**Role in bigger picture**: Webhooks are critical for subscription systems because they handle the "background" events that keep your database in sync with Stripe. This simulator lets you test that your webhook handlers correctly process subscription changes, update user credits, handle payment failures, and manage edge cases. Without this, you'd have to manually trigger events in the Stripe dashboard or wait for real subscription events to test your webhook logic.

# How They Work Together

- Environment Setup: test-server.ts starts your API with mocks injected, while mock-services.ts provides fake external services
- Data Preparation: seed-database.ts creates a clean test environment with known users and states
- Test Execution: test-runner.ts orchestrates tests, using mock-stripe-data.ts for consistent test data
- Event Simulation: webhook-simulator.ts sends realistic webhook events to test background processing
- Validation: Everything is verified against the database and expected behaviors

This creates a complete parallel universe where your subscription system runs exactly as it would in production, but everything is safe, predictable, and controllable. You can test payment failures without losing money, subscription changes without affecting real customers, and edge cases without breaking anything. When tests pass here, you have high confidence your code will work correctly in production.

---

# STEPS TO RUN TEST

0. Rename `example.env` and `example.env.test` to `.env` and `.env.test` respectively in `/` and `test-utils/`

1. `docker stop searchleads-test-db 2>/dev/null || true`
2. `docker rm searchleads-test-db 2>/dev/null || true`
3. `docker run -d --name searchleads-test-db -e POSTGRES_USER=testuser -e POSTGRES_PASSWORD=testpass123 -e POSTGRES_DB=searchleads_test -p 5433:5432 postgres:15`
4. `npx prisma db push --force-reset --schema=./prisma/schema.prisma`

### Terminal 1 :

5. `npm run test:server`

### Terminal 2 :

6. `npm run test:complete`
