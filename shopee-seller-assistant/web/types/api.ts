// Types mirroring the existing REST API responses (Sprint A). The frontend
// treats all monetary values as backend-formatted rupiah strings and never
// recomputes any fee/profit/margin value.

export type SellerTier = "REGULAR" | "STAR" | "STAR_PLUS" | "MALL";
export type FeeType = "ADMIN" | "SERVICE" | "PAYMENT";
export type DiscountType = "NONE" | "PERCENTAGE" | "FLAT";

export interface Seller {
  id: string;
  userId: string;
  storeName: string;
  marketplace: string;
  sellerTier: SellerTier;
  createdAt: string;
  updatedAt: string;
}

export interface FeeRule {
  id: string;
  feeProfileId: string;
  feeType: FeeType;
  rate: string; // decimal string, e.g. "0.02"
  cap: string | null; // rupiah string or null
  createdAt: string;
}

export interface FeeProfile {
  id: string;
  sellerProfileId: string;
  effectiveDate: string;
  endDate: string | null;
  sourceReference: string;
  createdAt: string;
}

export interface FeeProfileVersion {
  profile: FeeProfile;
  rules: FeeRule[];
}

export interface FeeLine {
  feeType: FeeType;
  base: string;
  rawFee: string;
  appliedFee: string;
  capBound: boolean;
}

export interface ProfitResult {
  effectivePrice: string;
  feeLines: FeeLine[];
  totalFees: string;
  netRevenue: string;
  netProfit: string;
  marginPct: string | null;
  markupPct: string | null;
  status: string;
}

export type RecommendationMode =
  | "TARGET_PROFIT"
  | "TARGET_MARGIN"
  | "TARGET_MARKUP"
  | "MIN_VIABLE";

export interface BreakEvenResult {
  price: string | null;
  bindingCaps: FeeType[];
  status: string;
}

export interface RecommendResult {
  recommendedPrice: string | null;
  breakEvenFloor: string;
  roundTrip: ProfitResult | null;
  feasibility: string;
  ceiling: string | null;
  status: string;
}

// ---- request payloads ----

export interface NewFeeRuleInput {
  feeType: FeeType;
  rate: string;
  cap: string | null;
}

export interface NewFeeProfileVersionInput {
  effectiveDate: string;
  endDate: string | null;
  sourceReference: string;
  rules: NewFeeRuleInput[];
}

export interface ProfitRequestInput {
  asOfDate: string;
  sellingPrice: string;
  costInputs: { productCost: string; packagingCost: string };
  discount: { type: DiscountType; value: string | null };
}

export interface BreakEvenRequestInput {
  asOfDate: string;
  costInputs: { productCost: string; packagingCost: string };
}

export interface RecommendRequestInput {
  asOfDate: string;
  mode: RecommendationMode;
  costInputs: { productCost: string; packagingCost: string };
  targetProfit?: string;
  targetMargin?: string;
  targetMarkup?: string;
  safetyBuffer?: string;
  discount?: { type: DiscountType; value: string | null };
}

// ---- error envelope ----

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}
