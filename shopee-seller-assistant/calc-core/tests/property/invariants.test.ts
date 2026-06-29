import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  type CostInputs,
  type DiscountInput,
  type ProfitInputs,
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
import { calculateDiscount } from '../../src/discount';
import { calculateProfit } from '../../src/profit-engine';
import { calculateBreakEven } from '../../src/break-even';
import { recommendPrice } from '../../src/recommend-price';
import { verifyRoundTrip } from '../../src/round-trip';

/* --------------------------- fixtures/helpers -------------------------- */

const STANDARD: ResolvedFeeProfile = {
  sellerTier: SellerTier.REGULAR,
  asOfDate: '2026-06-25',
  admin: { feeType: FeeType.ADMIN, rate: Rate.of('0.02'), cap: Money.fromRupiah(10000) },
  service: { feeType: FeeType.SERVICE, rate: Rate.of('0.04'), cap: null },
  payment: { feeType: FeeType.PAYMENT, rate: Rate.of('0.02'), cap: null },
};

/** ceiling = 1 − Σ(uncapped rates) = 1 − (0.04 + 0.02) = 0.94 for STANDARD. */

function rate(pct: number): Rate {
  return Rate.of((pct / 100).toFixed(4));
}

function costOf(product: number, packaging = 0): CostInputs {
  return {
    productCost: Money.fromRupiah(product),
    packagingCost: Money.fromRupiah(packaging),
  };
}

function totalCostMoney(c: CostInputs): Money {
  return c.productCost.add(c.packagingCost);
}

function forwardProfit(price: Money, cost: Money, profile = STANDARD): Money {
  const { totalFees } = calculateFees(price, profile);
  return price.sub(totalFees).sub(cost);
}

function profitInput(
  price: Money,
  discount: DiscountInput,
  cost: CostInputs,
): ProfitInputs {
  return {
    costInputs: cost,
    sellingPrice: price,
    discount,
    sellerTier: SellerTier.REGULAR,
    asOfDate: '2026-06-25',
    profile: STANDARD,
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

const TOL = Money.fromRupiah(2);

/* -------------------------------- I1 ---------------------------------- */

describe('I1 — break-even forward profit is within ±2 IDR of zero', () => {
  // NB: the blueprint originally phrased this as [0, 2], but per-fee round-half-up
  // can over-collect beyond the price-ceil, so the true bound is the G-5 ±2
  // tolerance (empirically [-1, +1]). Accepted per release audit (D1).
  it('holds across costs, including the admin-cap region', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2_000_000 }),
        fc.integer({ min: 0, max: 200_000 }),
        (product, packaging) => {
          const cost = costOf(product, packaging);
          const be = calculateBreakEven(totalCostMoney(cost), STANDARD);
          if (be.status !== ResultStatus.OK || be.price === null) return false;
          const profit = forwardProfit(be.price, totalCostMoney(cost));
          return profit.abs().lte(TOL);
        },
      ),
      { numRuns: 300 },
    );
  });
});

/* -------------------------------- I2 ---------------------------------- */

describe('I2 — recommendation round-trips within ±2 IDR (all modes)', () => {
  it('A: Target Profit (with and without planned discount)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3_000_000 }),
        fc.integer({ min: 0, max: 90 }), // planned discount %
        (target, discPct) => {
          const planned: DiscountInput =
            discPct === 0
              ? { type: DiscountType.NONE, value: null }
              : { type: DiscountType.PERCENTAGE, value: rate(discPct) };
          const inp = recInput({
            mode: RecommendationMode.TARGET_PROFIT,
            targetProfit: Money.fromRupiah(target),
            plannedDiscount: planned,
          });
          const res = unwrap(recommendPrice(inp));
          return verifyRoundTrip(inp, res).passed;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('B: Target Margin (feasible region, margin < ceiling 0.94)', () => {
    // Covers the [0.92, 0.94) band fixed by D3 (capped fees bind before NO_SOLUTION).
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 93 }), (marginPct) => {
        const inp = recInput({
          mode: RecommendationMode.TARGET_MARGIN,
          targetMargin: rate(marginPct),
        });
        const res = unwrap(recommendPrice(inp));
        if (res.feasibility !== ResultStatus.OK) return false;
        return verifyRoundTrip(inp, res).passed;
      }),
      { numRuns: 100 },
    );
  });

  it('C: Target Markup', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 400 }), // markup %
        fc.integer({ min: 1, max: 2_000_000 }), // cost (>0 for markup)
        (markupPct, product) => {
          const inp = recInput({
            mode: RecommendationMode.TARGET_MARKUP,
            targetMarkup: rate(markupPct),
            costInputs: costOf(product),
          });
          const res = unwrap(recommendPrice(inp));
          return verifyRoundTrip(inp, res).passed;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('D: Min Viable', () => {
    // buffer ≥ 0: the D2 fix (symmetric ±2 round-trip tolerance) means the
    // break-even price recommended at buffer 0 no longer throws on small costs.
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }), // buffer %
        fc.integer({ min: 1, max: 2_000_000 }), // total cost > 0 (free product is degenerate)
        (bufferPct, product) => {
          const inp = recInput({
            mode: RecommendationMode.MIN_VIABLE,
            safetyBuffer: rate(bufferPct),
            costInputs: costOf(product),
          });
          const res = unwrap(recommendPrice(inp));
          const check = verifyRoundTrip(inp, res);
          return (
            check.passed &&
            res.recommendedPrice !== null &&
            res.recommendedPrice.gte(res.breakEvenFloor)
          );
        },
      ),
      { numRuns: 200 },
    );
  });
});

/* -------------------------------- I4 ---------------------------------- */

describe('I4 — 0 ≤ effective price ≤ selling price', () => {
  it('holds for NONE, PERCENTAGE, and FLAT discounts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000_000 }),
        fc.oneof(
          fc.constant<DiscountInput>({ type: DiscountType.NONE, value: null }),
          fc
            .integer({ min: 0, max: 100 })
            .map<DiscountInput>((p) => ({
              type: DiscountType.PERCENTAGE,
              value: rate(p),
            })),
          fc
            .integer({ min: 0, max: 15_000_000 })
            .map<DiscountInput>((v) => ({
              type: DiscountType.FLAT,
              value: Money.fromRupiah(v),
            })),
        ),
        (priceN, discount) => {
          const price = Money.fromRupiah(priceN);
          const { effectivePrice } = calculateDiscount(price, discount);
          return effectivePrice.gte(Money.zero()) && effectivePrice.lte(price);
        },
      ),
      { numRuns: 300 },
    );
  });
});

/* -------------------------------- I5 ---------------------------------- */

describe('I5 — profit is strictly monotonic above break-even', () => {
  it('a higher price yields strictly higher profit', () => {
    const cost = totalCostMoney(costOf(45000, 3000)); // break-even ≈ 52,174
    fc.assert(
      fc.property(
        fc.integer({ min: 53_000, max: 5_000_000 }),
        fc.integer({ min: 1, max: 1_000_000 }),
        (base, delta) => {
          const p1 = Money.fromRupiah(base);
          const p2 = Money.fromRupiah(base + delta);
          return forwardProfit(p2, cost).gt(forwardProfit(p1, cost));
        },
      ),
      { numRuns: 300 },
    );
  });
});

/* ------------------------------- I11 ---------------------------------- */

describe('I11 — discount never increases profit; zero discount is a no-op', () => {
  it('profit(no discount) ≥ profit(percentage discount) at the same price', () => {
    const cost = costOf(45000, 3000);
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5_000_000 }),
        fc.integer({ min: 0, max: 100 }),
        (priceN, discPct) => {
          const price = Money.fromRupiah(priceN);
          const none = unwrap(
            calculateProfit(
              profitInput(price, { type: DiscountType.NONE, value: null }, cost),
            ),
          );
          const disc = unwrap(
            calculateProfit(
              profitInput(
                price,
                { type: DiscountType.PERCENTAGE, value: rate(discPct) },
                cost,
              ),
            ),
          );
          return none.netProfit.gte(disc.netProfit);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('NONE leaves the effective price equal to the selling price', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10_000_000 }), (priceN) => {
        const price = Money.fromRupiah(priceN);
        const { effectivePrice } = calculateDiscount(price, {
          type: DiscountType.NONE,
          value: null,
        });
        return effectivePrice.eq(price);
      }),
      { numRuns: 200 },
    );
  });
});

/* ------------------------------- I12 ---------------------------------- */

describe('I12 — margin feasibility is bounded by the ceiling (0.94)', () => {
  it('target margin ≥ ceiling ⇒ INFEASIBLE_CEILING(0.94)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 94, max: 130 }), (marginPct) => {
        const inp = recInput({
          mode: RecommendationMode.TARGET_MARGIN,
          targetMargin: rate(marginPct),
        });
        const res = unwrap(recommendPrice(inp));
        return (
          res.feasibility === ResultStatus.INFEASIBLE_CEILING &&
          res.recommendedPrice === null &&
          res.ceiling?.toString() === '0.94'
        );
      }),
      { numRuns: 100 },
    );
  });

  it('target margin below ceiling ⇒ feasible with a price', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 93 }), (marginPct) => {
        const inp = recInput({
          mode: RecommendationMode.TARGET_MARGIN,
          targetMargin: rate(marginPct),
        });
        const res = unwrap(recommendPrice(inp));
        return (
          res.feasibility === ResultStatus.OK && res.recommendedPrice !== null
        );
      }),
      { numRuns: 100 },
    );
  });
});
