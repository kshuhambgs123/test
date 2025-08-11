export interface InvoiceData {
  from: string;
  to: string;
  logo: string;
  number: string;
  date: string;
  "items[0][name]": string;
  "items[0][quantity]": string;
  "items[0][unit_cost]": string;
  notes: string;
  currency: string;
  amount_paid: string;
}

export interface StripePaymentMetadata {
  client: string;
  credits: string;
  subscriptionPlan?: string;
  currency: string;
  userId: string;
  clientName?: string;
}

export interface PaymentIDDetail {
  id: string;
  object: string;
  active: boolean;
  billing_scheme: string;
  created: number;
  currency: string;
  custom_unit_amount: null | {
    enabled: boolean;
    maximum: number | null;
    minimum: number | null;
    preset: number | null;
  };
  livemode: boolean;
  lookup_key: string | null;
  metadata: Record<string, string>;
  nickname: string | null;
  product: string;
  recurring: {
    aggregate_usage: string | null;
    interval: string;
    interval_count: number;
    trial_period_days: number | null;
    usage_type: string;
  };
  tax_behavior: string;
  tiers_mode: string | null;
  transform_quantity: string | null;
  type: string;
  unit_amount: number | null;
  unit_amount_decimal: string | null;
}

export interface SubscriptionTier {
  priceId: string;
  credits: number;
  amount: number; // in cents
}

export interface SubscriptionMetadata {
  userId: string;
  tierName: string;
  credits: string;
  isUpgrade: string;
  upgradeFrom: string;
}

export interface SubscriptionCreateRequest {
  customerId: string;
  tierName: string;
  userId: string;
}

export interface SubscriptionUpgradeRequest {
  customerId: string;
  newTierName: string;
  userId: string;
}

export interface LeadStatusResponse {
  record_id: string; // Unique identifier for the record
  apollo_link: string; // Link associated with Apollo (if any)
  file_name: string; // Name of the file (if any)
  requested_leads_count: string; // Number of requested leads (stored as a string)
  enrichment_status: string; // Status of the enrichment process
  spreadsheet_url: string; // URL of the associated Google spreadsheet
  enriched_records: number; // Count of enriched records
  credits_involved: number; // Number of credits involved in the process
  phase1: string; // Phase 1 details (if any)
}

import { Request } from "express";

export interface LoginRequest extends Request {
  body: {
    email: string;
    password: string;
  };
}

export interface ChangePriceRequest extends Request {
  body: {
    newPrice: number;
  };
}

export interface ChangeAutomationLinkRequest extends Request {
  body: {
    automationLink: string;
  };
}

export interface ChangeDNSRequest extends Request {
  body: {
    newDNS: string;
  };
}

export interface ChangeStatusRequest extends Request {
  body: {
    statusLink: string;
  };
}

export interface UpdateCreditsRequest extends Request {
  body: {
    userID: string;
    credits: number;
  };
}

export interface ChangeEnrichPriceRequest extends Request {
  body: {
    newPrice: number;
  };
}

export interface FormattedInvoice {
  id: string;
  type: "manual" | "subscription";
  amount: number;
  currency: string;
  status: string;
  date: Date;
  description: string;
  invoiceUrl?: string;
  creditsProvided?: number | null;
  subscriptionId?: string;
  invoicePdf?: string;
  periodStart?: Date | null;
  periodEnd?: Date | null;
}

export interface UpcomingInvoiceInfo {
  amount: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface UpstashResponse {
  result?: any;
  error?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: any;
}
