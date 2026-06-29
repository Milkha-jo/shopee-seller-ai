import { describe, expect, it } from 'vitest';
import {
  type CostInputs,
  type DiscountInput,
  DiscountType,
  FeeType,
  Money,
  Rate,
  type RecommendInput,
  RecommendationMode,
  type ResolvedFee,
  type ResolvedFeeProfile,
  ResultStatus,
  SellerTier,
} from '../../../src/types';
import { isErr, unwrap, unwrapErr } from '../../../src/errors';
import { recommendPrice } from '../../../src/recommend-price';

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

describe('recommendPrice — golden fixtures', () => {
  it('F4: Target Profit 30,000 → 84,783, round-trip profit 30,000', () => {
    const r = unwrap(
      recommendPrice(
        input({
          mode: RecommendationMode.TARGET_PROFIT,
          targetProfit: Money.fromRupiah(30000),
        }),
      ),
    );
    expect(r.feasibility).toBe(ResultStatus.OK);
    expect(r.recommendedPrice?.toString()).toBe('84783');
    expect(r.roundTrip?.netProfit.toString()).toBe('30000');
    expect(r.breakEvenFloor.toString()).toBe('52174');
    expect(r.roundTrip?.breakEvenPrice.toString()).toBe('52174');
  });

  it('F5: Target Margin 30% → 77,420, round-trip margin ≈ 0.30', () => {
    const r = unwrap(
      recommendPrice(
        input({
          mode: RecommendationMode.TARGET_MARGIN,
          targetMargin: Rate.of('0.30'),
        }),
      ),
    );
    expect(r.recommendedPrice?.toString()).toBe('77420');
    expect(r.roundTrip?.netProfit.toString()).toBe('23227');
    expect(r.roundTrip?.marginPct?.toDecimal().toDecimalPlaces(4).toString()).toBe('0.3');
  });

  it('F6: Target Markup 50% → 78,261, round-trip markup ≈ 0.50', () => {
    const r = unwrap(
      recommendPrice(
        input({
          mode: RecommendationMode.TARGET_MARKUP,
          targetMarkup: Rate.of('0.50'),
        }),
      ),
    );
    expect(r.recommendedPrice?.toString()).toBe('78261');
    expect(r.roundTrip?.netProfit.toString()).toBe('24001');
    expect(r.roundTrip?.markupPct?.toDecimal().toDecimalPlaces(4).toString()).toBe('0.5');
  });

  it('F7: Min Viable, buffer 10% → 57,392, floor 52,174', () => {
    const r = unwrap(
      recommendPrice(
        input({
          mode: RecommendationMode.MIN_VIABLE,
          safetyBuffer: Rate.of('0.10'),
        }),
      ),
    );
    expect(r.recommendedPrice?.toString()).toBe('57392');
    expect(r.breakEvenFloor.toString()).toBe('52174');
    expect(r.roundTrip?.netProfit.gte(Money.zero())).toBe(true);
  });

  it('F8: Target Profit 30,000 + 20% planned discount → list 105,979', () => {
    const r = unwrap(
      recommendPrice(
        input({
          mode: RecommendationMode.TARGET_PROFIT,
          targetProfit: Money.fromRupiah(30000),
          plannedDiscount: {
            type: DiscountType.PERCENTAGE,
            value: Rate.of('0.20'),
          },
        }),
      ),
    );
    expect(r.recommendedPrice?.toString()).toBe('105979');
    // after the 20% discount the effective price returns to the F4 effective
    expect(r.roundTrip?.effectivePrice.toString()).toBe('84783');
    expect(r.roundTrip?.netProfit.toString()).toBe('30000');
  });

  it('F10: Target Margin 95% → INFEASIBLE_CEILING, ceiling 0.94', () => {
    const r = unwrap(
      recommendPrice(
        input({
          mode: RecommendationMode.TARGET_MARGIN,
          targetMargin: Rate.of('0.95'),
        }),
      ),
    );
    expect(r.feasibility).toBe(ResultStatus.INFEASIBLE_CEILING);
    expect(r.status).toBe(ResultStatus.INFEASIBLE_CEILING);
    expect(r.ceiling?.toString()).toBe('0.94');
    expect(r.recommendedPrice).toBeNull();
    expect(r.roundTrip).toBeNull();
  });
});

describe('recommendPrice — additional cases', () => {
  it('Min Viable with no buffer recommends the break-even price itself', () => {
    const r = unwrap(
      recommendPrice(input({ mode: RecommendationMode.MIN_VIABLE })),
    );
    expect(r.recommendedPrice?.toString()).toBe('52174');
    expect(r.breakEvenFloor.toString()).toBe('52174');
  });

  it('returns NO_SOLUTION when fee rates sum to >= 100%', () => {
    const bad: ResolvedFeeProfile = {
      sellerTier: SellerTier.REGULAR,
      asOfDate: '2026-06-25',
      admin: fee(FeeType.ADMIN, '0.40', null),
      service: fee(FeeType.SERVICE, '0.40', null),
      payment: fee(FeeType.PAYMENT, '0.40', null),
    };
    const r = unwrap(
      recommendPrice(
        input({
          mode: RecommendationMode.TARGET_PROFIT,
          targetProfit: Money.fromRupiah(1000),
          profile: bad,
        }),
      ),
    );
    expect(r.status).toBe(ResultStatus.NO_SOLUTION);
    expect(r.recommendedPrice).toBeNull();
  });

  it('propagates an input-validation error (missing target)', () => {
    const r = recommendPrice(input({ mode: RecommendationMode.TARGET_PROFIT }));
    expect(isErr(r)).toBe(true);
    expect(unwrapErr(r).kind).toBe('INPUT_VALIDATION');
  });
});
