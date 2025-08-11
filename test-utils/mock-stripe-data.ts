// mock-stripe-data.ts

export interface MockStripeProduct {
  id: string;
  object: string;
  active: boolean;
  created: number;
  default_price: string | null;
  description: string | null;
  images: string[];
  livemode: boolean;
  metadata: Record<string, string>;
  name: string;
  package_dimensions: null;
  shippable: null;
  statement_descriptor: string | null;
  tax_code: string | null;
  type: string;
  unit_label: string | null;
  updated: number;
  url: string | null;
}

export interface MockStripePrice {
  id: string;
  object: string;
  active: boolean;
  billing_scheme: string;
  created: number;
  currency: string;
  custom_unit_amount: null;
  livemode: boolean;
  lookup_key: string | null;
  metadata: Record<string, string>;
  nickname: string | null;
  product: MockStripeProduct;
  recurring: {
    aggregate_usage: null;
    interval: string;
    interval_count: number;
    trial_period_days: null;
    usage_type: string;
  };
  tax_behavior: string;
  tiers_mode: null;
  transform_quantity: null;
  type: string;
  unit_amount: number;
  unit_amount_decimal: string;
}

export interface MockStripeCustomer {
  id: string;
  object: string;
  address: null;
  balance: number;
  created: number;
  currency: string;
  default_source: null;
  delinquent: boolean;
  description: string | null;
  discount: null;
  email: string;
  invoice_prefix: string;
  invoice_settings: {
    custom_fields: null;
    default_payment_method: null;
    footer: null;
  };
  livemode: boolean;
  metadata: Record<string, string>;
  name: string;
  phone: string | null;
  preferred_locales: string[];
  shipping: null;
  sources: {
    object: string;
    data: any[];
    has_more: boolean;
    total_count: number;
    url: string;
  };
  subscriptions: {
    object: string;
    data: any[];
    has_more: boolean;
    total_count: number;
    url: string;
  };
  tax_exempt: string;
  tax_ids: {
    object: string;
    data: any[];
    has_more: boolean;
    total_count: number;
    url: string;
  };
}

// Mock Stripe products with exact Stripe API format
export const MOCK_STRIPE_PRODUCTS: Record<string, MockStripeProduct> = {
  searchleads_recurring_tier_10k: {
    id: "prod_test_tier_10k",
    object: "product",
    active: true,
    created: 1640995200,
    default_price: "price_test_tier_10k",
    description: "10,000 monthly lead enrichment credits",
    images: [],
    livemode: false,
    metadata: {
      tier: "10k",
      credits: "10000",
    },
    name: "searchleads_recurring_tier_10k",
    package_dimensions: null,
    shippable: null,
    statement_descriptor: null,
    tax_code: null,
    type: "service",
    unit_label: null,
    updated: 1640995200,
    url: null,
  },
  searchleads_recurring_tier_20k: {
    id: "prod_test_tier_20k",
    object: "product",
    active: true,
    created: 1640995200,
    default_price: "price_test_tier_20k",
    description: "20,000 monthly lead enrichment credits",
    images: [],
    livemode: false,
    metadata: {
      tier: "20k",
      credits: "20000",
    },
    name: "searchleads_recurring_tier_20k",
    package_dimensions: null,
    shippable: null,
    statement_descriptor: null,
    tax_code: null,
    type: "service",
    unit_label: null,
    updated: 1640995200,
    url: null,
  },
  searchleads_recurring_tier_30k: {
    id: "prod_test_tier_30k",
    object: "product",
    active: true,
    created: 1640995200,
    default_price: "price_test_tier_30k",
    description: "30,000 monthly lead enrichment credits",
    images: [],
    livemode: false,
    metadata: {
      tier: "30k",
      credits: "30000",
    },
    name: "searchleads_recurring_tier_30k",
    package_dimensions: null,
    shippable: null,
    statement_descriptor: null,
    tax_code: null,
    type: "service",
    unit_label: null,
    updated: 1640995200,
    url: null,
  },
  searchleads_recurring_tier_40k: {
    id: "prod_test_tier_40k",
    object: "product",
    active: true,
    created: 1640995200,
    default_price: "price_test_tier_40k",
    description: "40,000 monthly lead enrichment credits",
    images: [],
    livemode: false,
    metadata: {
      tier: "40k",
      credits: "40000",
    },
    name: "searchleads_recurring_tier_40k",
    package_dimensions: null,
    shippable: null,
    statement_descriptor: null,
    tax_code: null,
    type: "service",
    unit_label: null,
    updated: 1640995200,
    url: null,
  },
  searchleads_recurring_tier_50k: {
    id: "prod_test_tier_50k",
    object: "product",
    active: true,
    created: 1640995200,
    default_price: "price_test_tier_50k",
    description: "50,000 monthly lead enrichment credits",
    images: [],
    livemode: false,
    metadata: {
      tier: "50k",
      credits: "50000",
    },
    name: "searchleads_recurring_tier_50k",
    package_dimensions: null,
    shippable: null,
    statement_descriptor: null,
    tax_code: null,
    type: "service",
    unit_label: null,
    updated: 1640995200,
    url: null,
  },
};

// Mock Stripe prices with complete Stripe API format
export const MOCK_STRIPE_PRICES: MockStripePrice[] = [
  {
    id: "price_test_tier_10k",
    object: "price",
    active: true,
    billing_scheme: "per_unit",
    created: 1640995200,
    currency: "usd",
    custom_unit_amount: null,
    livemode: false,
    lookup_key: null,
    metadata: {
      tier: "10k",
      credits: "10000",
    },
    nickname: "SearchLeads 10K Plan",
    product: MOCK_STRIPE_PRODUCTS["searchleads_recurring_tier_10k"],
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
    unit_amount: 2000, // $20.00
    unit_amount_decimal: "2000",
  },
  {
    id: "price_test_tier_20k",
    object: "price",
    active: true,
    billing_scheme: "per_unit",
    created: 1640995200,
    currency: "usd",
    custom_unit_amount: null,
    livemode: false,
    lookup_key: null,
    metadata: {
      tier: "20k",
      credits: "20000",
    },
    nickname: "SearchLeads 20K Plan",
    product: MOCK_STRIPE_PRODUCTS["searchleads_recurring_tier_20k"],
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
    unit_amount: 4000, // $40.00
    unit_amount_decimal: "4000",
  },
  {
    id: "price_test_tier_30k",
    object: "price",
    active: true,
    billing_scheme: "per_unit",
    created: 1640995200,
    currency: "usd",
    custom_unit_amount: null,
    livemode: false,
    lookup_key: null,
    metadata: {
      tier: "30k",
      credits: "30000",
    },
    nickname: "SearchLeads 30K Plan",
    product: MOCK_STRIPE_PRODUCTS["searchleads_recurring_tier_30k"],
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
    unit_amount: 6000, // $60.00
    unit_amount_decimal: "6000",
  },
  {
    id: "price_test_tier_40k",
    object: "price",
    active: true,
    billing_scheme: "per_unit",
    created: 1640995200,
    currency: "usd",
    custom_unit_amount: null,
    livemode: false,
    lookup_key: null,
    metadata: {
      tier: "40k",
      credits: "40000",
    },
    nickname: "SearchLeads 40K Plan",
    product: MOCK_STRIPE_PRODUCTS["searchleads_recurring_tier_40k"],
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
    unit_amount: 8000, // $80.00
    unit_amount_decimal: "8000",
  },
  {
    id: "price_test_tier_50k",
    object: "price",
    active: true,
    billing_scheme: "per_unit",
    created: 1640995200,
    currency: "usd",
    custom_unit_amount: null,
    livemode: false,
    lookup_key: null,
    metadata: {
      tier: "50k",
      credits: "50000",
    },
    nickname: "SearchLeads 50K Plan",
    product: MOCK_STRIPE_PRODUCTS["searchleads_recurring_tier_50k"],
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
    unit_amount: 10000, // $100.00
    unit_amount_decimal: "10000",
  },
];

// Mock Stripe customers with complete Stripe API format
export const MOCK_STRIPE_CUSTOMERS: Record<string, MockStripeCustomer> = {
  "john.doe@testcompany.com": {
    id: "cus_test_user_1",
    object: "customer",
    address: null,
    balance: 0,
    created: 1640995200,
    currency: "usd",
    default_source: null,
    delinquent: false,
    description: null,
    discount: null,
    email: "john.doe@testcompany.com",
    invoice_prefix: "test_user_1".slice(-8),
    invoice_settings: {
      custom_fields: null,
      default_payment_method: null,
      footer: null,
    },
    livemode: false,
    metadata: {
      userId: "test_user_1",
    },
    name: "John Doe",
    phone: null,
    preferred_locales: [],
    shipping: null,
    sources: {
      object: "list",
      data: [],
      has_more: false,
      total_count: 0,
      url: "/v1/customers/cus_test_user_1/sources",
    },
    subscriptions: {
      object: "list",
      data: [],
      has_more: false,
      total_count: 0,
      url: "/v1/customers/cus_test_user_1/subscriptions",
    },
    tax_exempt: "none",
    tax_ids: {
      object: "list",
      data: [],
      has_more: false,
      total_count: 0,
      url: "/v1/customers/cus_test_user_1/tax_ids",
    },
  },
  "jane.smith@testcorp.com": {
    id: "cus_test_user_2",
    object: "customer",
    address: null,
    balance: 0,
    created: 1640995200,
    currency: "usd",
    default_source: null,
    delinquent: false,
    description: null,
    discount: null,
    email: "jane.smith@testcorp.com",
    invoice_prefix: "test_user_2".slice(-8),
    invoice_settings: {
      custom_fields: null,
      default_payment_method: null,
      footer: null,
    },
    livemode: false,
    metadata: {
      userId: "test_user_2",
    },
    name: "Jane Smith",
    phone: null,
    preferred_locales: [],
    shipping: null,
    sources: {
      object: "list",
      data: [],
      has_more: false,
      total_count: 0,
      url: "/v1/customers/cus_test_user_2/sources",
    },
    subscriptions: {
      object: "list",
      data: [],
      has_more: false,
      total_count: 0,
      url: "/v1/customers/cus_test_user_2/subscriptions",
    },
    tax_exempt: "none",
    tax_ids: {
      object: "list",
      data: [],
      has_more: false,
      total_count: 0,
      url: "/v1/customers/cus_test_user_2/tax_ids",
    },
  },
  "bob.wilson@mockbusiness.com": {
    id: "cus_test_user_3",
    object: "customer",
    address: null,
    balance: 0,
    created: 1640995200,
    currency: "usd",
    default_source: null,
    delinquent: false,
    description: null,
    discount: null,
    email: "bob.wilson@mockbusiness.com",
    invoice_prefix: "test_user_3".slice(-8),
    invoice_settings: {
      custom_fields: null,
      default_payment_method: null,
      footer: null,
    },
    livemode: false,
    metadata: {
      userId: "test_user_3",
    },
    name: "Bob Wilson",
    phone: null,
    preferred_locales: [],
    shipping: null,
    sources: {
      object: "list",
      data: [],
      has_more: false,
      total_count: 0,
      url: "/v1/customers/cus_test_user_3/sources",
    },
    subscriptions: {
      object: "list",
      data: [],
      has_more: false,
      total_count: 0,
      url: "/v1/customers/cus_test_user_3/subscriptions",
    },
    tax_exempt: "none",
    tax_ids: {
      object: "list",
      data: [],
      has_more: false,
      total_count: 0,
      url: "/v1/customers/cus_test_user_3/tax_ids",
    },
  },
  "alice.johnson@demotech.com": {
    id: "cus_test_user_4",
    object: "customer",
    address: null,
    balance: 0,
    created: 1640995200,
    currency: "usd",
    default_source: null,
    delinquent: false,
    description: null,
    discount: null,
    email: "alice.johnson@demotech.com",
    invoice_prefix: "test_user_4".slice(-8),
    invoice_settings: {
      custom_fields: null,
      default_payment_method: null,
      footer: null,
    },
    livemode: false,
    metadata: {
      userId: "test_user_4",
    },
    name: "Alice Johnson",
    phone: null,
    preferred_locales: [],
    shipping: null,
    sources: {
      object: "list",
      data: [],
      has_more: false,
      total_count: 0,
      url: "/v1/customers/cus_test_user_4/sources",
    },
    subscriptions: {
      object: "list",
      data: [],
      has_more: false,
      total_count: 0,
      url: "/v1/customers/cus_test_user_4/subscriptions",
    },
    tax_exempt: "none",
    tax_ids: {
      object: "list",
      data: [],
      has_more: false,
      total_count: 0,
      url: "/v1/customers/cus_test_user_4/tax_ids",
    },
  },
  "charlie.brown@sampleinc.com": {
    id: "cus_test_user_5",
    object: "customer",
    address: null,
    balance: 0,
    created: 1640995200,
    currency: "usd",
    default_source: null,
    delinquent: false,
    description: null,
    discount: null,
    email: "charlie.brown@sampleinc.com",
    invoice_prefix: "test_user_5".slice(-8),
    invoice_settings: {
      custom_fields: null,
      default_payment_method: null,
      footer: null,
    },
    livemode: false,
    metadata: {
      userId: "test_user_5",
    },
    name: "Charlie Brown",
    phone: null,
    preferred_locales: [],
    shipping: null,
    sources: {
      object: "list",
      data: [],
      has_more: false,
      total_count: 0,
      url: "/v1/customers/cus_test_user_5/sources",
    },
    subscriptions: {
      object: "list",
      data: [],
      has_more: false,
      total_count: 0,
      url: "/v1/customers/cus_test_user_5/subscriptions",
    },
    tax_exempt: "none",
    tax_ids: {
      object: "list",
      data: [],
      has_more: false,
      total_count: 0,
      url: "/v1/customers/cus_test_user_5/tax_ids",
    },
  },
};

// Expected tier mapping (what your system should generate) - unchanged
export const EXPECTED_SUBSCRIPTION_TIERS = {
  tier_10k: {
    priceId: "price_test_tier_10k",
    credits: 10000,
    amount: 2000,
    productName: "searchleads_recurring_tier_10k",
    productId: "prod_test_tier_10k",
  },
  tier_20k: {
    priceId: "price_test_tier_20k",
    credits: 20000,
    amount: 4000,
    productName: "searchleads_recurring_tier_20k",
    productId: "prod_test_tier_20k",
  },
  tier_30k: {
    priceId: "price_test_tier_30k",
    credits: 30000,
    amount: 6000,
    productName: "searchleads_recurring_tier_30k",
    productId: "prod_test_tier_30k",
  },
  tier_40k: {
    priceId: "price_test_tier_40k",
    credits: 40000,
    amount: 8000,
    productName: "searchleads_recurring_tier_40k",
    productId: "prod_test_tier_40k",
  },
  tier_50k: {
    priceId: "price_test_tier_50k",
    credits: 50000,
    amount: 10000,
    productName: "searchleads_recurring_tier_50k",
    productId: "prod_test_tier_50k",
  },
};
