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
import { calculateFees } from '../../src/fees/calculator';
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

function costOf(product: number, packaging = 0): CostInputs {
  return {
    productCost: Money.fromRupiah(product),
    packagingCost: Money.fromRupiah(packaging),
  };
}

function recInput(over: Partial<RecommendInput>): RecommendInput {
  return {
    mode: RecommendationMode.TARGET_PROFIT,
    costInputs: costOf(45000, 3000),
    sellerTier: SellerTier.REGULAR,
    asOfDate: '2026-06-25',
    profile: STANDARD,
    ...over,
  };
}

describe('edge matrix — profit engine', () => {
  it('price < cost yields a valid negative profit (status OK)', () => {
    const pc = unwrap(
      calculateProfit({
        costInputs: costOf(45000, 3000),
        sellingPrice: Money.fromRupiah(30000),
        discount: { type: DiscountType.NONE, value: null },
        sellerTier: SellerTier.REGULAR,
        asOfDate: '2026-06-25',
        profile: STANDARD,
      }),
    );
    expect(pc.status).toBe(ResultStatus.OK);
    expect(pc.netProfit.isNegative()).toBe(true);
    expect(pc.netProfit.toString()).toBe('-20400');
    expect(pc.marginPct).toBeDefined(); // defined (negative), effective > 0
  });

  it('very large amounts keep exact precision (billion-scale break-even)', () => {
    const cost = costOf(999_999_999, 1); // 1,000,000,000
    const be = calculateBreakEven(Money.fromRupiah(1_000_000_000), STANDARD);
    expect(be.status).toBe(ResultStatus.OK);
    expect(be.bindingCaps).toEqual([FeeType.ADMIN]); // admin caps out at scale
    const price = be.price!;
    const { totalFees } = calculateFees(price, STANDARD);
    const profit = price.sub(totalFees).sub(Money.fromRupiah(1_000_000_000));
    expect(profit.gte(Money.zero())).toBe(true);
    expect(profit.lte(Money.fromRupiah(2))).toBe(true);
    expect(price.isInteger()).toBe(true);
  });
});

describe('edge matrix — recommend degenerate targets', () => {
  it('target profit = 0 recommends the break-even price', () => {
    const res = unwrap(
      recommendPrice(
        recInput({ mode: RecommendationMode.TARGET_PROFIT, targetProfit: Money.zero() }),
      ),
    );
    expect(res.recommendedPrice?.toString()).toBe(res.breakEvenFloor.toString());
  });

  it('target margin = 0 recommends the break-even price', () => {
    const res = unwrap(
      recommendPrice(
        recInput({ mode: RecommendationMode.TARGET_MARGIN, targetMargin: Rate.of('0') }),
      ),
    );
    expect(res.feasibility).toBe(ResultStatus.OK);
    expect(res.recommendedPrice?.toString()).toBe(res.breakEvenFloor.toString());
  });

  it('min-viable buffer = 0 recommends the break-even price', () => {
    const res = unwrap(
      recommendPrice(recInput({ mode: RecommendationMode.MIN_VIABLE })),
    );
    expect(res.recommendedPrice?.toString()).toBe(res.breakEvenFloor.toString());
  });
});

describe('edge matrix — resolved release-audit deviations', () => {
  // ---- D3 (resolved): mode-B feasibility ceiling [0.92, 0.94) ----
  // Ceiling for STANDARD is 0.94 (admin capped, excluded). The cap-correction
  // now force-binds capped fees before declaring NO_SOLUTION, so a 93% target
  // margin resolves at a high price instead of falsely reporting infeasibility.
  it('target margin 0.93 is feasible (D3 resolved)', () => {
    const res = unwrap(
      recommendPrice(
        recInput({ mode: RecommendationMode.TARGET_MARGIN, targetMargin: Rate.of('0.93') }),
      ),
    );
    expect(res.feasibility).toBe(ResultStatus.OK);
    expect(res.recommendedPrice).not.toBeNull();
  });

  // ---- D2 (resolved): mode-D buffer-0 round-trip on small costs ----
  // Break-even forward profit can be −1 IDR (within the G-5 ±2 tolerance). The
  // mode-D round-trip assertion now accepts realized ≥ −2, so the break-even
  // price recommended at buffer 0 no longer throws.
  it('min-viable buffer 0 at cost 23 does not throw (D2 resolved)', () => {
    const res = unwrap(
      recommendPrice(
        recInput({
          mode: RecommendationMode.MIN_VIABLE,
          costInputs: costOf(23, 0),
        }),
      ),
    );
    expect(res.recommendedPrice).not.toBeNull();
  });
});
