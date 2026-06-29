import { Money } from '../money';
import {
  DiscountType,
  FeeType,
  RecommendationMode,
  ResultStatus,
  SellerTier,
} from './enums';
import { Rate } from './rate';

/** ISO calendar date, 'YYYY-MM-DD'. (Format is validated elsewhere.) */
export type IsoDate = string;

/** Opaque reference/id of a fee source. */
export type SourceRef = string;

/* --------------------------- fee data shapes --------------------------- */

/** A single fee rate row as supplied to the resolver (percentage fees only). */
export interface FeeRateRow {
  readonly feeType: FeeType;
  readonly rate: Rate;
  readonly cap: Money | null;
  readonly effectiveDate: IsoDate;
  readonly endDate: IsoDate | null;
  readonly sourceRef: SourceRef;
}

/** A resolved fee for one fee type. */
export interface ResolvedFee {
  readonly feeType: FeeType;
  readonly rate: Rate;
  readonly cap: Money | null;
}

/** A complete, resolved profile: all three fee types are guaranteed present. */
export interface ResolvedFeeProfile {
  readonly sellerTier: SellerTier;
  readonly asOfDate: IsoDate;
  readonly admin: ResolvedFee;
  readonly service: ResolvedFee;
  readonly payment: ResolvedFee;
}

/** One computed fee line (output). */
export interface FeeLine {
  readonly feeType: FeeType;
  readonly base: Money;
  readonly rawFee: Money;
  readonly appliedFee: Money;
  readonly capBound: boolean;
}

/* ------------------------------- inputs -------------------------------- */

export interface CostInputs {
  readonly productCost: Money;
  readonly packagingCost: Money;
}

/**
 * A discount.
 * - PERCENTAGE → `value` is a `Rate` (fraction, 0.20 = 20%)
 * - FLAT       → `value` is a `Money`
 * - NONE       → `value` is null
 */
export interface DiscountInput {
  readonly type: DiscountType;
  readonly value: Money | Rate | null;
}

export interface ProfitInputs {
  readonly costInputs: CostInputs;
  readonly sellingPrice: Money;
  readonly discount: DiscountInput;
  readonly sellerTier: SellerTier;
  readonly asOfDate: IsoDate;
  readonly profile: ResolvedFeeProfile;
}

export interface RecommendInput {
  readonly mode: RecommendationMode;
  readonly costInputs: CostInputs;
  readonly sellerTier: SellerTier;
  readonly asOfDate: IsoDate;
  /** Mode A. */
  readonly targetProfit?: Money;
  /** Mode B (fraction). */
  readonly targetMargin?: Rate;
  /** Mode C (fraction). */
  readonly targetMarkup?: Rate;
  /** Mode D (fraction). */
  readonly safetyBuffer?: Rate;
  readonly plannedDiscount?: DiscountInput;
  readonly profile: ResolvedFeeProfile;
}

/* ------------------------------- outputs ------------------------------- */

export interface ProfitResult {
  readonly effectivePrice: Money;
  readonly feeLines: readonly FeeLine[];
  readonly totalFees: Money;
  readonly netRevenue: Money;
  readonly netProfit: Money;
  /** Fraction; absent when status is MARGIN_UNDEFINED. */
  readonly marginPct?: Rate;
  /** Fraction; absent when status is MARKUP_UNDEFINED. */
  readonly markupPct?: Rate;
  readonly breakEvenPrice: Money;
  readonly status: ResultStatus;
}

export interface BreakEvenResult {
  /** OK, or NO_SOLUTION. */
  readonly status: ResultStatus;
  /** Present when status is OK; null when NO_SOLUTION. */
  readonly price: Money | null;
  readonly bindingCaps: readonly FeeType[];
}

export interface RecommendResult {
  /** Null when infeasible / no solution. */
  readonly recommendedPrice: Money | null;
  /** Null when infeasible / no solution. */
  readonly roundTrip: ProfitResult | null;
  readonly breakEvenFloor: Money;
  /** OK | INFEASIBLE_CEILING | NO_SOLUTION. */
  readonly feasibility: ResultStatus;
  /** Present (fraction) when feasibility is INFEASIBLE_CEILING. */
  readonly ceiling?: Rate;
  readonly status: ResultStatus;
}
