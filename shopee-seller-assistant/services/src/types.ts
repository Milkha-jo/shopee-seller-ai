import type {
  CostInputs,
  DiscountInput,
  FeeType,
  IsoDate,
  Money,
  Rate,
} from '@core/types';
import type { FeeProfile, FeeRule } from '@repo/domain';

/** Input to a profit calculation. The seller tier and resolved fee profile are
 *  loaded by the service from the seller; the caller supplies only pricing. */
export interface ProfitRequest {
  readonly sellerProfileId: string;
  readonly asOfDate: IsoDate;
  readonly sellingPrice: Money;
  readonly costInputs: CostInputs;
  readonly discount: DiscountInput;
}

/** A new fee rule within a version. */
export interface NewFeeRule {
  readonly feeType: FeeType;
  readonly rate: Rate;
  readonly cap: Money | null;
}

/** A complete new fee-profile version (the profile window + its rules). */
export interface NewFeeProfileVersion {
  readonly sellerProfileId: string;
  readonly effectiveDate: IsoDate;
  readonly endDate: IsoDate | null;
  readonly sourceReference: string;
  readonly rules: readonly NewFeeRule[];
}

/** A fee-profile version as returned by the service: the profile and its rules. */
export interface FeeProfileVersion {
  readonly profile: FeeProfile;
  readonly rules: readonly FeeRule[];
}
