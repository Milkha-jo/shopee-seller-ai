import { describe, expect, it } from 'vitest';
import {
  type CostInputs,
  DiscountType,
  type RecommendInput,
  type RecommendResult,
  FeeType,
  Money,
  Rate,
  RecommendationMode,
  type ResolvedFee,
  type ResolvedFeeProfile,
  ResultStatus,
  SellerTier,
} from '../../../src/types';
import { unwrap } from '../../../src/errors';
import { recommendPrice } from '../../../src/recommend-price';
import { verifyRoundTrip } from '../../../src/round-trip';

function fee(feeType: FeeType, rate: string, cap: Money | null): ResolvedFee {
  return { feeType, rate: Rate.of(rate), cap };
}

const profile: ResolvedFeeProfile = {
  sellerTier: SellerTier.REGULAR,
  asOfDate: '2026-06-25',
  admin: fee(FeeType.ADMIN, '0.02', Money.fromRupiah(10000)),
  service: fee(FeeType.SERVICE, '0.04', null),
  payment: fee(FeeType.PAYMENT, '0.02', null),
};

const cost: CostInputs = {
  productCost: Money.fromRupiah(45000),
  packagingCost: Money.fromRupiah(3000),
};

function input(over: Partial<RecommendInput>): RecommendInput {
  return {
    mode: RecommendationMode.TARGET_PROFIT,
    costInputs: cost,
    sellerTier: SellerTier.REGULAR,
    asOfDate: '2026-06-25',
    profile,
    ...over,
  };
}

describe('verifyRoundTrip — all modes pass within ±2 IDR', () => {
  it('A: Target Profit', () => {
    const inp = input({
      mode: RecommendationMode.TARGET_PROFIT,
      targetProfit: Money.fromRupiah(30000),
    });
    const res = unwrap(recommendPrice(inp));
    const check = verifyRoundTrip(inp, res);
    expect(check.applicable).toBe(true);
    expect(check.passed).toBe(true);
    expect(check.differenceAbs?.lte(Money.fromRupiah(2))).toBe(true);
  });

  it('B: Target Margin', () => {
    const inp = input({
      mode: RecommendationMode.TARGET_MARGIN,
      targetMargin: Rate.of('0.30'),
    });
    const res = unwrap(recommendPrice(inp));
    const check = verifyRoundTrip(inp, res);
    expect(check.passed).toBe(true);
    expect(check.differenceAbs?.lte(Money.fromRupiah(2))).toBe(true);
  });

  it('C: Target Markup', () => {
    const inp = input({
      mode: RecommendationMode.TARGET_MARKUP,
      targetMarkup: Rate.of('0.50'),
    });
    const res = unwrap(recommendPrice(inp));
    const check = verifyRoundTrip(inp, res);
    expect(check.passed).toBe(true);
    expect(check.differenceAbs?.lte(Money.fromRupiah(2))).toBe(true);
  });

  it('D: Min Viable', () => {
    const inp = input({
      mode: RecommendationMode.MIN_VIABLE,
      safetyBuffer: Rate.of('0.10'),
    });
    const res = unwrap(recommendPrice(inp));
    const check = verifyRoundTrip(inp, res);
    expect(check.passed).toBe(true);
    expect(check.impliedProfit).toBeNull(); // D uses the floor check
    expect(check.realizedProfit?.gte(Money.zero())).toBe(true);
  });

  it('A with planned discount round-trips through the discount', () => {
    const inp = input({
      mode: RecommendationMode.TARGET_PROFIT,
      targetProfit: Money.fromRupiah(30000),
      plannedDiscount: { type: DiscountType.PERCENTAGE, value: Rate.of('0.20') },
    });
    const res = unwrap(recommendPrice(inp));
    const check = verifyRoundTrip(inp, res);
    expect(check.passed).toBe(true);
  });
});

describe('verifyRoundTrip — boundary behavior', () => {
  it('is vacuously applicable=false for an infeasible recommendation', () => {
    const inp = input({
      mode: RecommendationMode.TARGET_MARGIN,
      targetMargin: Rate.of('0.95'),
    });
    const res = unwrap(recommendPrice(inp));
    expect(res.feasibility).toBe(ResultStatus.INFEASIBLE_CEILING);
    const check = verifyRoundTrip(inp, res);
    expect(check.applicable).toBe(false);
    expect(check.passed).toBe(true);
  });

  it('detects a corrupted recommendation (price off by 5,000)', () => {
    const inp = input({
      mode: RecommendationMode.TARGET_PROFIT,
      targetProfit: Money.fromRupiah(30000),
    });
    const good = unwrap(recommendPrice(inp));
    // Tamper with the recommended price so the realized profit drifts.
    const tampered: RecommendResult = {
      ...good,
      recommendedPrice: good.recommendedPrice!.sub(Money.fromRupiah(5000)),
    };
    const check = verifyRoundTrip(inp, tampered);
    expect(check.applicable).toBe(true);
    expect(check.passed).toBe(false);
    expect(check.differenceAbs?.gt(Money.fromRupiah(2))).toBe(true);
  });
});
