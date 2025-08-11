# SearchLeads Payments API Documentation

## Overview

Complete API documentation for the SearchLeads payments system built with Stripe integration. This API handles both one-time credit purchases and monthly subscription plans using a hybrid credit system.

### Environment Variables Required

```bash
STRIPE_PUBLIC_SECRET_KEY - Your Stripe secret key
STRIPE_WEBHOOK_SECRET - Webhook endpoint secret from Stripe dashboard
DATABASE_URL - PostgreSQL connection string
SUPABASE_BASE_URL - Supabase project URL
SUPABASE_ANON_KEY - Supabase anonymous key
```

### Authentication

All endpoints except webhooks require Supabase JWT authentication
`bash Authorization: Bearer <supabase_jwt_token>`

### Base URL

`http://localhost:5050/api/payments`

## Credit System Overview

SearchLeads uses a hybrid credit system:

- subscriptionCredits: Monthly allowance from subscription plans (reset monthly)
- credits: Pay-as-you-go credits (purchased individually, never expire)
- Deduction Priority: subscriptionCredits used first, then credits

### Subscription Tiers

Dynamic tiers loaded from Stripe products with naming convention: `searchleads_recurring_tier_[TIER]`.
Examples of `TIER`: 10k, 20k, 30k, 40k, 50k

# Webhook - `POST /searchLeadsConfirmPayment`

**Purpose**: Stripe webhook endpoint that processes all payment events

**Authentication**: None (Stripe signature verification)

**Content-Type**: application/json (raw body required)

**Webhook Events Handled**:

- `payment_intent.succeeded`: One-time credit purchases
- `customer.subscription.created`: New subscription setup
- `customer.subscription.updated`: Subscription changes
- `customer.subscription.deleted`: Subscription cancellations
- `invoice.payment_succeeded`: Monthly renewal, reset credits
- `invoice.payment_failed`: Mark subscription past_due
- `invoice.payment_action_required`: SCA authentication needed
- `customer.deleted`: Clean up deleted customer data

**Request** :

```bash
curl -X POST "http://localhost:5050/api/payments/searchLeadsConfirmPayment" \
 -H "Content-Type: application/json" \
 -H "Stripe-Signature: t=12345,v1=SIGNATURE" \
 -d '{
   "id": "evt_1234567890abcdef",
   "object": "event",
   "type": "payment_intent.succeeded",
   "data": {
     "object": {
       "id": "pi_1234567890abcdef",
       "metadata": {
         "userId": "user_uuid_here",
         "credits": "5000"
       }
     }
   }
 }'
```

**Success Response**:

```json
{
  "received": true
}
```

**Duplicate Event Response**:

```json
{
  "received": true,
  "duplicate": true
}
```

**Error Response**:

```json
{
  "error": "Invalid signature"
}
```

# Subscriptions

## 1. Subscription Creation : `POST /createSubscription`

**Purpose**: Create new monthly subscription for user

**Authentication**: Supabase JWT required

**Reqeust**:

```bash
curl -X POST "http://localhost:5050/api/payments/createSubscription" \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer <supabase_jwt_token>" \
 -d '{
"customerId": "cus_1234567890abcdef",
"tierName": "searchleads_recurring_tier_20k",
"userId": "user_uuid_from_database"
}'
```

**Parameters**:

- customerId (string, required): Stripe Customer ID
- tierName (string, required): Subscription tier (searchleads_recurring_tier_10k, ...\_tier_20k, etc)
- userId (string, required): Internal User ID from database

**Success Response**:

```json
{
  "subscription": {
    "id": "sub_1234567890abcdef",
    "status": "incomplete",
    "current_period_end": 1640995200
  },
  "clientSecret": "pi_1234_secret_abc123"
}
```

**Error Response**:

```json
{
  "error": "Invalid subscription tier"
}
```

## 2. Subscription Upgrade - `POST /upgradeSubscription`

**Purpose**: Upgrade to higher subscription tier (cancels current, starts fresh billing cycle)

**Authentication**: Supabase JWT required

```bash
curl -X POST "http://localhost:5050/api/payments/upgradeSubscription" \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer <supabase_jwt_token>" \
 -d '{
"customerId": "cus_1234567890abcdef",
"newTierName": "searchleads_recurring_tier_40k",
"userId": "user_uuid_from_database"
}'
```

**Parameters**:

- customerId (string, required): Stripe Customer ID
- newTierName (string, required): New subscription tier to upgrade to
- userId (string, required): Internal User ID

**Success Response**:

```json
{
  "subscription": {
    "id": "sub_new_1234567890abcdef",
    "status": "incomplete",
    "current_period_end": 1640995200
  },
  "clientSecret": "pi_1234_secret_def456"
}
```

**Error Response**:

```json
{
  "error": "No active subscription found"
}
```

## 3. Cancel Subscription - `POST /cancelSubscription`

**Purpose**: Cancel active subscription immediately

**Authentication**: Supabase JWT required

**Request**:

```bash
curl -X POST "http://localhost:5050/api/payments/cancelSubscription" \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer <supabase_jwt_token>" \
 -d '{
"subscriptionId": "sub_1234567890abcdef",
"userId": "user_uuid_from_database"
}'
```

**Parameters**:

- subscriptionId (string, required): Stripe Subscription ID
- userId (string, required): Internal User ID

**Success Response**:

```json
{
  "subscription": {
    "id": "sub_1234567890abcdef",
    "status": "canceled",
    "canceled_at": 1640995200
  }
}
```

## 4. Subscription Information - `GET /getSubscriptionStatus/:customerId`

**Purpose**: Get current subscription status and credit balance

**Authentication**: Supabase JWT required

**Request**:

```bash
curl -X GET "http://localhost:5050/api/payments/getSubscriptionStatus/cus_1234567890abcdef" \
 -H "Authorization: Bearer <supabase_jwt_token>"
```

**Success Response**:

```json
{
  "subscriptionStatus": "active",
  "subscriptionPlan": "searchleads_recurring_tier_20k",
  "subscriptionCredits": 15000,
  "purchasedCredits": 5000,
  "totalCredits": 20000,
  "subscriptionCurrentPeriodEnd": "2025-02-15T00:00:00.000Z"
}
```

**Error Response**:

```json
{
  "error": "User not found"
}
```

# Customer Management

## 1. Add new customer - `POST /createCustomer`

**Purpose**: Create new Stripe customer

**Authentication**: Supabase JWT required

**Request**:

```bash
curl -X POST "http://localhost:5050/api/payments/createCustomer" \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer <supabase_jwt_token>" \
 -d '{
"name": "John Doe",
"email": "john@example.com",
"couponID": "SAVE10"
}'
```

**Parameters**:

- name (string, required): Customer full name
- email (string, required): Customer email address
- couponID (string, optional): Coupon code to apply

**Success Response**:

```json
{
  "customer": {
    "id": "cus_1234567890abcdef",
    "email": "john@example.com",
    "name": "John Doe"
  }
}
```

## 2. Get user - POST /findCustomerByEmail

**Purpose**: Find existing Stripe customer by email address

**Authentication**: Supabase JWT required

**Request**:

```bash
curl -X POST "http://localhost:5050/api/payments/findCustomerByEmail" \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer <supabase_jwt_token>" \
 -d '{
"email": "john@example.com"
}'
```

**Parameters**:

- email (string, required): Customer email to search for

**Success Response**:

```json
{
  "customerId": "cus_1234567890abcdef"
}
```

**Not Found Response**:

```json
{
  "message": "Customer not found"
}
```

## 3. Remove discounts - `POST /deleteCustomerDiscount`

**Purpose**: Remove discount/coupon from customer
**Authentication**: Supabase JWT required

```bash
curl -X POST "http://localhost:5050/api/payments/deleteCustomerDiscount" \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer <supabase_jwt_token>" \
 -d '{
"customerId": "cus_1234567890abcdef"
}'
```

**Parameters**:

- customerId (string, required): Stripe Customer ID

**Success Response**:

```json
{
  "deletedCustomer": {
    "id": "cus_1234567890abcdef",
    "discount": null
  }
}
```

# Payment Intent Management

## 1. Creation - `POST /createPaymentIntent`

**Purpose**: Create payment intent for one-time credit purchases

**Authentication**: Supabase JWT required

```bash
curl -X POST "http://localhost:5050/api/payments/createPaymentIntent" \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer <supabase_jwt_token>" \
 -d '{
"amount": 2000,
"currency": "usd",
"costumerID": "cus_1234567890abcdef",
"description": "Credit Purchase - 5000 credits",
"automaticPayment": true,
"referral": "affiliate_123",
"credits": "5000",
"userID": "user_uuid_from_database",
"cientName": "John Doe Company"
}'
```

**Parameters**:

- amount (number, required): Amount in cents (2000 = $20.00)
- currency (string, required): Currency code (usd, eur, etc)
- costumerID (string, required): Stripe Customer ID
- description (string, required): Payment description
- automaticPayment (boolean, required): Enable automatic payment methods
- referral (string, optional): Referral/affiliate code
- credits (string, required): Number of credits to add
- userID (string, required): Internal User ID
- cientName (string, optional): Client company name

**Success Response**:

```json
{
  "paymentIntent": {
    "id": "pi_1234567890abcdef",
    "client_secret": "pi_1234_secret_abc123",
    "status": "requires_payment_method"
  }
}
```

## 2. Cancelling Intent - `POST /paymentCancelledIntent`

**Purpose**: Cancel existing payment intent

**Authentication**: Supabase JWT required

```bash
curl -X POST "http://localhost:5050/api/payments/paymentCancelledIntent" \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer <supabase_jwt_token>" \
 -d '{
"paymentIntentId": "pi_1234567890abcdef",
"cancellationReason": "requested_by_customer"
}'
```

**Parameters**:

- paymentIntentId (string, required): Payment Intent ID to cancel
- cancellationReason (string, required): Reason for cancellation

**Success Response**:

```json
{
  "paymentIntent": {
    "id": "pi_1234567890abcdef",
    "status": "canceled",
    "cancellation_reason": "requested_by_customer"
  }
}
```

# Coupon Management

## 1. Status Check - `POST /retrieveCoupon`

**Purpose**: Get coupon details and validity

**Authentication**: Supabase JWT required

```bash
curl -X POST "http://localhost:5050/api/payments/retrieveCoupon" \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer <supabase_jwt_token>" \
 -d '{
"couponCode": "SAVE10"
}'
```

**Parameters**:

- couponCode (string, required): Coupon code to validate

**Success Response**:

```json
{
  "coupon": {
    "id": "SAVE10",
    "percent_off": 10,
    "valid": true,
    "max_redemptions": 100,
    "times_redeemed": 25
  }
}
```

## 2. Assign to user - `POST /updateCouponCode`

**Purpose**: Apply coupon to existing customer

**Authentication**: Supabase JWT required

```bash
curl -X POST "http://localhost:5050/api/payments/updateCouponCode" \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer <supabase_jwt_token>" \
 -d '{
"customerId": "cus_1234567890abcdef",
"couponCode": "SAVE10"
}'
```

**Parameters**:

- customerId (string, required): Stripe Customer ID
- couponCode (string, required): Coupon code to apply

**Success Response**:

```json
{
  "updatedCustomer": {
    "id": "cus_1234567890abcdef",
    "discount": {
      "coupon": {
        "id": "SAVE10",
        "percent_off": 10
      }
    }
  }
}
```

# Webhook Setup in Stripe Dashboard

Go to Stripe Dashboard > Developers > Webhooks
Add endpoint: https://yourdomain.com/api/payments/searchLeadsConfirmPayment
Select these events:

```

payment_intent.succeeded
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.payment_succeeded
invoice.payment_failed
invoice.payment_action_required
customer.deleted

```

**Error Handling**

All endpoints return status 500 for server errors:

```json
{
  "message": "Detailed error message"
}
```

Webhook endpoint returns status 200 even for errors to prevent Stripe retries:

```json
{
  "error": "Error description",
  "received": true
}
```

## Important Notes

- Webhook endpoint uses idempotency checking to prevent duplicate processing
- Subscription upgrades cancel the current subscription and create a new one
- When subscriptions are canceled, unused subscription credits are converted to purchased credits
- Monthly subscription credits reset on successful invoice payment
- Credit deduction prioritizes subscription credits first, then purchased credits
- All amounts in Stripe are in cents (2000 cents = $20.00)
- Subscription tiers are dynamically loaded from Stripe products using naming convention
- Past due subscriptions retain their credit balance until payment succeeds or subscription is canceled
