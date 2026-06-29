import type { Money, Rate, RecommendResult } from '@core/types';
import type { ProfitCalculation } from '@core/profit-engine';
import type { BreakEvenCalculation } from '@core/break-even';
import type { FeeProfile, FeeRule, SellerProfile, User } from '@repo/domain';
import type { FeeProfileVersion } from '@svc/types';

const money = (m: Money): string => m.toString();
const rate = (r: Rate): string => r.toString();

export const presentUser = (u: User) => ({
  id: u.id,
  email: u.email,
  createdAt: u.createdAt,
});

export const presentSeller = (s: SellerProfile) => ({
  id: s.id,
  userId: s.userId,
  storeName: s.storeName,
  marketplace: s.marketplace,
  sellerTier: s.sellerTier,
  createdAt: s.createdAt,
  updatedAt: s.updatedAt,
});

export const presentFeeProfile = (p: FeeProfile) => ({
  id: p.id,
  sellerProfileId: p.sellerProfileId,
  effectiveDate: p.effectiveDate,
  endDate: p.endDate,
  sourceReference: p.sourceReference,
  createdAt: p.createdAt,
});

export const presentFeeRule = (r: FeeRule) => ({
  id: r.id,
  feeProfileId: r.feeProfileId,
  feeType: r.feeType,
  rate: rate(r.rate),
  cap: r.cap === null ? null : money(r.cap),
  createdAt: r.createdAt,
});

export const presentVersion = (v: FeeProfileVersion) => ({
  profile: presentFeeProfile(v.profile),
  rules: v.rules.map(presentFeeRule),
});

export const presentProfit = (c: ProfitCalculation) => ({
  effectivePrice: money(c.effectivePrice),
  feeLines: c.feeLines.map((l) => ({
    feeType: l.feeType,
    base: money(l.base),
    rawFee: money(l.rawFee),
    appliedFee: money(l.appliedFee),
    capBound: l.capBound,
  })),
  totalFees: money(c.totalFees),
  netRevenue: money(c.netRevenue),
  netProfit: money(c.netProfit),
  marginPct: c.marginPct === undefined ? null : rate(c.marginPct),
  markupPct: c.markupPct === undefined ? null : rate(c.markupPct),
  status: c.status,
});

export const presentBreakEven = (b: BreakEvenCalculation) => ({
  price: b.price === null ? null : money(b.price),
  bindingCaps: b.bindingCaps,
  status: b.status,
});

export const presentRecommend = (r: RecommendResult) => ({
  recommendedPrice: r.recommendedPrice === null ? null : money(r.recommendedPrice),
  breakEvenFloor: money(r.breakEvenFloor),
  // ProfitResult is a structural superset of ProfitCalculation; reuse the
  // forward presenter so the round-trip serializes identically to /profit.
  roundTrip: r.roundTrip === null ? null : presentProfit(r.roundTrip),
  feasibility: r.feasibility,
  ceiling: r.ceiling === undefined ? null : rate(r.ceiling),
  status: r.status,
});
