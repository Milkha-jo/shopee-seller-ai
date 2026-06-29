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

function recInput(over: Partial<RecommendInput>): RecommendInput {
  return {
    mode: RecommendationMode.TARGET_PROFIT,
    costInputs: cost,
    sellerTier: SellerTier.REGULAR,
    asOfDate: '2026-06-25',
    profile: STANDARD,
    ...over,
  };
}

function repeat<T>(n: number, fn: () => T): T[] {
  return Array.from({ length: n }, fn);
}

describe('I10 — determinism: identical inputs ⇒ identical outputs', () => {
  it('calculateProfit is deterministic', () => {
    const outputs = repeat(8, () => {
      const pc = unwrap(
        calculateProfit({
          costInputs: cost,
          sellingPrice: Money.fromRupiah(84783),
          discount: { type: DiscountType.PERCENTAGE, value: Rate.of('0.20') },
          sellerTier: SellerTier.REGULAR,
          asOfDate: '2026-06-25',
          profile: STANDARD,
        }),
      );
      return [
        pc.effectivePrice.toString(),
        pc.totalFees.toString(),
        pc.netProfit.toString(),
        pc.marginPct?.toString() ?? 'undef',
        pc.markupPct?.toString() ?? 'undef',
        pc.status,
      ].join('|');
    });
    expect(new Set(outputs).size).toBe(1);
  });

  it('calculateBreakEven is deterministic (incl. cap-binding region)', () => {
    const outputs = repeat(8, () => {
      const be = calculateBreakEven(Money.fromRupiah(200000), {
        ...STANDARD,
        admin: { feeType: FeeType.ADMIN, rate: Rate.of('0.02'), cap: Money.fromRupiah(1000) },
      });
      return `${be.price?.toString() ?? 'null'}|${be.bindingCaps.join(',')}|${be.status}`;
    });
    expect(new Set(outputs).size).toBe(1);
  });

  it('recommendPrice is deterministic across all four modes', () => {
    const cases: RecommendInput[] = [
      recInput({ mode: RecommendationMode.TARGET_PROFIT, targetProfit: Money.fromRupiah(30000) }),
      recInput({ mode: RecommendationMode.TARGET_MARGIN, targetMargin: Rate.of('0.30') }),
      recInput({ mode: RecommendationMode.TARGET_MARKUP, targetMarkup: Rate.of('0.50') }),
      recInput({ mode: RecommendationMode.MIN_VIABLE, safetyBuffer: Rate.of('0.10') }),
    ];
    for (const c of cases) {
      const outputs = repeat(8, () => {
        const r = unwrap(recommendPrice(c));
        return [
          r.recommendedPrice?.toString() ?? 'null',
          r.breakEvenFloor.toString(),
          r.roundTrip?.netProfit.toString() ?? 'null',
          r.feasibility,
          r.status,
        ].join('|');
      });
      expect(new Set(outputs).size).toBe(1);
    }
  });
});
