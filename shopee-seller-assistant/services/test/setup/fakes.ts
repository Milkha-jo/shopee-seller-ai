import { FeeType, Money, Rate, SellerTier } from '@core/types';
import type { FeeProfile, FeeRule, SellerProfile } from '@repo/domain';

export const sellerProfile = (over: Partial<SellerProfile> = {}): SellerProfile => ({
  id: 's1',
  userId: 'u1',
  storeName: 'Toko',
  marketplace: 'SHOPEE',
  sellerTier: SellerTier.REGULAR,
  createdAt: 'C',
  updatedAt: 'U',
  ...over,
});

export const feeProfile = (over: Partial<FeeProfile> = {}): FeeProfile => ({
  id: 'fp1',
  sellerProfileId: 's1',
  effectiveDate: '2026-01-01',
  endDate: null,
  sourceReference: 'src',
  createdAt: 'C',
  ...over,
});

export const feeRule = (
  feeType: FeeType,
  rate: string,
  cap: number | null,
): FeeRule => ({
  id: `r-${feeType}`,
  feeProfileId: 'fp1',
  feeType,
  rate: Rate.of(rate),
  cap: cap === null ? null : Money.fromRupiah(cap),
  createdAt: 'C',
});

/** The standard Phase 1 golden fee set: admin 2% cap 10000, service 4%, payment 2%. */
export const standardRules = (): FeeRule[] => [
  feeRule(FeeType.ADMIN, '0.02', 10000),
  feeRule(FeeType.SERVICE, '0.04', null),
  feeRule(FeeType.PAYMENT, '0.02', null),
];
