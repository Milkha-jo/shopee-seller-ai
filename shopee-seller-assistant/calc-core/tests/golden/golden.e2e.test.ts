import { describe, expect, it } from 'vitest';
import {
  type CostInputs,
  DiscountType,
  FeeType,
  Money,
  Rate,
  type RecommendInput,
  RecommendationMode,
  type ResolvedFeeProfile,
  ResultStatus,
  SellerTier,
} from '../../src/types';
import { unwrap } from '../../src/errors';
import { calculateProfit } from '../../src/profit-engine';
import { calculateBreakEven } from '../../src/break-even';
import { recommendPrice } from '../../src/recommend-price';

const STANDARD: ResolvedFeeProfile = {
  sellerTier: SellerTier.REGULAR,
  asOfDate: '2026-06-25',
  admin: { feeType: FeeType.ADMIN, rate: Rate.of('0.02'), cap: Money.fromRupiah(10000) },
  service: { feeType: FeeType.SERVICE, rate: Rate.of('0.04'), cap: null },
  payment: { feeType: FeeType.PAYMENT, rate: Rate.of('0.02'), cap: null },
};

const cost: CostInputs = {
  productCost: Money.fromRupiah(45000),
  packagingCost: Money.fromRupiah(3000),
};

function profitAt(price: number, discount = { type: DiscountType.NONE, value: null } as const) {
  return unwrap(
    calculateProfit({
      costInputs: cost,
      sellingPrice: Money.fromRupiah(price),
      discount,
      sellerTier: SellerTier.REGULAR,
      asOfDate: '2026-06-25',
      profile: STANDARD,
    }),
  );
}

function rec(over: Partial<RecommendInput>) {
  return unwrap(
    recommendPrice({
      mode: RecommendationMode.TARGET_PROFIT,
      costInputs: cost,
      sellerTier: SellerTier.REGULAR,
      asOfDate: '2026-06-25',
      profile: STANDARD,
      ...over,
    }),
  );
}

describe('Golden fixtures — end-to-end through public APIs', () => {
  it('F1: profit at 100,000 → 44,000 / margin 0.44 / markup ≈ 0.9167', () => {
    const pc = profitAt(100000);
    expect(pc.netProfit.toString()).toBe('44000');
    expect(pc.marginPct?.toString()).toBe('0.44');
    expect(pc.markupPct?.toDecimal().toDecimalPlaces(4).toString()).toBe('0.9167');
  });

  it('F2: break-even at cost 48,000 → 52,174', () => {
    const be = calculateBreakEven(Money.fromRupiah(48000), STANDARD);
    expect(be.price?.toString()).toBe('52174');
    expect(be.status).toBe(ResultStatus.OK);
  });

  it('F4: Target Profit 30,000 → 84,783', () => {
    const r = rec({ mode: RecommendationMode.TARGET_PROFIT, targetProfit: Money.fromRupiah(30000) });
    expect(r.recommendedPrice?.toString()).toBe('84783');
    expect(r.roundTrip?.netProfit.toString()).toBe('30000');
  });

  it('F5: Target Margin 30% → 77,420', () => {
    const r = rec({ mode: RecommendationMode.TARGET_MARGIN, targetMargin: Rate.of('0.30') });
    expect(r.recommendedPrice?.toString()).toBe('77420');
  });

  it('F6: Target Markup 50% → 78,261', () => {
    const r = rec({ mode: RecommendationMode.TARGET_MARKUP, targetMarkup: Rate.of('0.50') });
    expect(r.recommendedPrice?.toString()).toBe('78261');
  });

  it('F7: Min Viable buffer 10% → 57,392', () => {
    const r = rec({ mode: RecommendationMode.MIN_VIABLE, safetyBuffer: Rate.of('0.10') });
    expect(r.recommendedPrice?.toString()).toBe('57392');
  });

  it('F8: Target Profit 30,000 + 20% discount → 105,979', () => {
    const r = rec({
      mode: RecommendationMode.TARGET_PROFIT,
      targetProfit: Money.fromRupiah(30000),
      plannedDiscount: { type: DiscountType.PERCENTAGE, value: Rate.of('0.20') },
    });
    expect(r.recommendedPrice?.toString()).toBe('105979');
    expect(r.roundTrip?.effectivePrice.toString()).toBe('84783');
  });

  it('F10: Target Margin 95% → INFEASIBLE_CEILING(0.94)', () => {
    const r = rec({ mode: RecommendationMode.TARGET_MARGIN, targetMargin: Rate.of('0.95') });
    expect(r.feasibility).toBe(ResultStatus.INFEASIBLE_CEILING);
    expect(r.ceiling?.toString()).toBe('0.94');
  });

  it('F11: 100% discount → effective 0 / MARGIN_UNDEFINED', () => {
    const pc = profitAt(80000, { type: DiscountType.PERCENTAGE, value: Rate.of('1') } as never);
    expect(pc.effectivePrice.toString()).toBe('0');
    expect(pc.netProfit.toString()).toBe('-48000');
    expect(pc.status).toBe(ResultStatus.MARGIN_UNDEFINED);
  });

  it('F12: cost 0 → MARKUP_UNDEFINED', () => {
    const pc = unwrap(
      calculateProfit({
        costInputs: { productCost: Money.zero(), packagingCost: Money.zero() },
        sellingPrice: Money.fromRupiah(100000),
        discount: { type: DiscountType.NONE, value: null },
        sellerTier: SellerTier.REGULAR,
        asOfDate: '2026-06-25',
        profile: STANDARD,
      }),
    );
    expect(pc.netProfit.toString()).toBe('92000');
    expect(pc.status).toBe(ResultStatus.MARKUP_UNDEFINED);
  });
});
