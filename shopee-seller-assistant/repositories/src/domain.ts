import type { FeeType, IsoDate, Money, Rate, SellerTier } from '@core/types';

// Domain representations returned by the repositories. UUIDs are strings;
// monetary caps are Money; rates are Rate; effective/end dates are IsoDate.
// Timestamps (created_at/updated_at) are ISO-8601 strings.

export interface User {
  readonly id: string;
  readonly email: string;
  readonly createdAt: string;
}

export interface SellerProfile {
  readonly id: string;
  readonly userId: string;
  readonly storeName: string;
  readonly marketplace: string;
  readonly sellerTier: SellerTier;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface FeeProfile {
  readonly id: string;
  readonly sellerProfileId: string;
  readonly effectiveDate: IsoDate;
  readonly endDate: IsoDate | null;
  readonly sourceReference: string;
  readonly createdAt: string;
}

export interface FeeRule {
  readonly id: string;
  readonly feeProfileId: string;
  readonly feeType: FeeType;
  readonly rate: Rate;
  readonly cap: Money | null;
  readonly createdAt: string;
}
