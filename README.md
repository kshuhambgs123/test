# Search Leads Backend

## Dependencies

- Prisma
- Supabase
- Node.js
- TypeScript
- Express

## How to run

1. Clone the repository
2. Run `npm install`
3. Run `npm run dev`
4. test the API using Postman or any other API testing tool by hitting the endpoint `http://localhost:5050/health`

## API Endpoints

### User

- GET `/health` - Check if the API is running
- POST `/api/user/register` - Register a new user
- GET `/api/user/getUser` - Get a user's details
- POST `/api/user/addCredits` - add Credits to a user's account
- GET `/api/user/getCredits` - Get a user's credits
- POST `/api/user/searchlead` - search for leads
- GET `/api/user/getCost` - Get cost per leads

### Logs

- GET `/api/logs/getUserLogs` - Get specific user's logs
- GET `/api/logs/getOneLogs` - Get one logs
- POST `/api/logs/checkLeadStatus`, - Check lead status

### Admin

- POST `/api/admin/login` - Admin login
- GET `/api/admin/getPrice` - Get price per 1000 leads
- POST `/api/admin/changePrice` - Change price
- POST `/api/admin/changeAutomationLink` - Change automation link
- POST `/api/admin/changeStatusLink` - Change automation status
- POST `/api/admin/changeDNS` - Change DNS
- GET `/api/admin/getAllUsers` - Get all users
- GET `/api/admin/getAllApikeys` - Get all api keys
- POST `/api/admin/generateAPIkey` - generates api key
- POST `/api/admin/getAPIkey` - get api key
- POST `/api/admin/revokeAPIkey` - delete api key
- POST `/api/admin/updateCredits` - updates user credits
- GET `/api/admin/getUser` - Gets user
- GET `/api/admin/getAllLogsById` - Get all logs by id
- GET `/api/admin/getAllLogs` - Get all logs

#### API

- POST `\api\v1\searchLeads` - Search for leads
- POST `\api\v1\checkleadStatus` - Check lead status

### Payments & Subscriptions

#### Payment Models

The platform supports three usage models:

1. **Pay-as-you-go**: Purchase credits individually using existing `/api/user/addCredits`
2. **Subscription-only**: Monthly recurring billing with credit allocation
3. **Hybrid model**: Subscription credits + additional pay-as-you-go credits

#### Subscription Tiers

- `tier_10k`: $20/month - 10,000 credits
- `tier_20k`: $40/month - 20,000 credits
- `tier_30k`: $60/month - 30,000 credits
- `tier_40k`: $80/month - 40,000 credits
- `tier_50k`: $100/month - 50,000 credits

#### Credit System Architecture

**Database Fields**:

```prisma
credits             Float  // Original field - purchased credits
subscriptionCredits Float  // New field - monthly subscription allowance
```

**Credit Deduction Priority**:

The system maintains backward compatibility with the existing credit system while adding subscription functionality:

`subscriptionCredits` - Deducted first (monthly allowance from active subscription).

`credits` - Deducted second (purchased credits from pay-as-you-go payments)

Example Scenarios:

```
Scenario 1 - Subscription + Purchased Credits

User has: subscriptionCredits: 5000, credits: 3000

Request: 7000 credits needed

Result:
- Deduct 5000 from subscriptionCredits (now 0)
- Deduct 2000 from credits (now 1000)
- Total remaining: 1000 credits (With subscription exhausted)
```

```
Scenario 2 - Insufficient Subscription Credits

User has: subscriptionCredits: 2000, credits: 1000

Request: 5000 credits needed

Result:
Request blocked - insufficient total credits (3000 < 5000)
Options: Upgrade subscription tier OR buy additional credits
```

```
Scenario 3 - Pay-as-you-go Only

User has: subscriptionCredits: 0, credits: 8000

Request: 3000 credits needed

Result:
Deduct 3000 from credits (now 5000)
Note: Works exactly like the original system
```

**Monthly Reset Behavior**:

- `subscriptionCredits` reset to tier allowance every billing cycle
- Unused `subscriptionCredits` don't carry over to next month
- `credits` persist and accumulate from purchases

**Backward Compatibility**:
Existing users without subscriptions continue using the original credits field normally. The subscription system is purely additive.

#### API Flow

**Subscription Creation Flow**:

1. `POST /api/payments/findCustomerByEmail` - Get or verify Stripe Customer ID
2. `POST /api/payments/createCustomer` - Create if customer doesn't exist
3. `POST /api/payments/createSubscription` - Create subscription
4. Frontend handles Stripe payment confirmation using `clientSecret`
5. Webhook automatically adds subscription credits to user account

**Credit Usage Flow**:

1. User calls credit-consuming endpoints
2. System deducts from `subscriptionCredits` first, then `credits`
3. If both exhausted, user must upgrade subscription or buy additional credits

**Upgrade Flow**:

1. `POST /api/payments/upgradeSubscription` - Cancels current, creates new subscription
2. Fresh billing cycle starts immediately with new credit allocation
3. Previous unused credits remain as purchased credits

**Subscription Management**:

- `GET /api/payments/getSubscriptionStatus/:customerId` - Check current status
- `POST /api/payments/cancelSubscription` - Cancel active subscription
- Credits automatically reset monthly via webhook on billing cycle

#### Subscription Endpoints

- POST `/api/payments/createSubscription` - Create new subscription
- POST `/api/payments/upgradeSubscription` - Upgrade tier (fresh billing cycle)
- POST `/api/payments/cancelSubscription` - Cancel subscription
- GET `/api/payments/getSubscriptionStatus/:customerId` - Get subscription info
- POST `/api/payments/findCustomerByEmail` - Find Stripe Customer ID
- POST `/api/payments/createCustomer` - Create Stripe customer
