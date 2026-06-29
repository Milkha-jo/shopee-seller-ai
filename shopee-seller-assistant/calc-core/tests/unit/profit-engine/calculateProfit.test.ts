import { describe, expect, it } from 'vitest';
import {
  type CostInputs,
  type DiscountInput,
  DiscountType,
  FeeType,
  Money,
  type ProfitInputs,
  Rate,
  type ResolvedFeeProfile,
  ResultStatus,
  SellerTier,
} from '../../../src/types';
import { isErr, isOk, unwrap, unwrapErr } from '../../../src/errors';
import { calculateProfit } from '../../../src/profit-engine';

const profile: ResolvedFeeProfile = {
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

function inputs(
  over: Partial<ProfitInputs> & { discount?: DiscountInput } = {},
): ProfitInputs {
  return {
    costInputs: over.costInputs ?? cost,
    sellingPrice: over.sellingPrice ?? Money.fromRupiah(100000),
    discount: over.discount ?? { type: DiscountType.NONE, value: null },
    sellerTier: SellerTier.REGULAR,
    asOfDate: '2026-06-25',
    profile,
  };
}

describe('calculateProfit — golden fixtures', () => {
  it('F1: base case → profit 44,000, margin 0.44, markup ≈ 0.9167', () => {
    const r = calculateProfit(inputs());
    expect(isOk(r)).toBe(true);
    const p = unwrap(r);
    expect(p.totalFees.toString()).toBe('8000');
    expect(p.netRevenue.toString()).toBe('92000');
    expect(p.netProfit.toString()).toBe('44000');
    expect(p.marginPct?.toString()).toBe('0.44');
    expect(p.markupPct?.toDecimal().toDecimalPlaces(4).toString()).toBe('0.9167');
    expect(p.status).toBe(ResultStatus.OK);
  });

  it('F3: 20% discount → effective 80,000, profit 25,600, margin 0.32', () => {
    const p = unwrap(
      calculateProfit(
        inputs({ discount: { type: DiscountType.PERCENTAGE, value: Rate.of('0.20') } }),
      ),
    );
    expect(p.effectivePrice.toString()).toBe('80000');
    expect(p.netProfit.toString()).toBe('25600');
    expect(p.marginPct?.toString()).toBe('0.32');
  });

  it('F11: 100% discount → effective 0, margin undefined, profit -48,000', () => {
    const p = unwrap(
      calculateProfit(
        inputs({ discount: { type: DiscountType.PERCENTAGE, value: Rate.of('1') } }),
      ),
    );
    expect(p.effectivePrice.toString()).toBe('0');
    expect(p.netProfit.toString()).toBe('-48000');
    expect(p.marginPct).toBeUndefined();
    expect(p.status).toBe(ResultStatus.MARGIN_UNDEFINED);
    // markup is still defined (cost > 0): -48000 / 48000 = -1
    expect(p.markupPct?.toString()).toBe('-1');
  });

  it('F12: zero cost → markup undefined, margin 0.92, profit 92,000', () => {
    const p = unwrap(
      calculateProfit(
        inputs({
          costInputs: {
            productCost: Money.zero(),
            packagingCost: Money.zero(),
          },
        }),
      ),
    );
    expect(p.netProfit.toString()).toBe('92000');
    expect(p.marginPct?.toString()).toBe('0.92');
    expect(p.markupPct).toBeUndefined();
    expect(p.status).toBe(ResultStatus.MARKUP_UNDEFINED);
  });
});

describe('calculateProfit — validation pass-through', () => {
  it('returns a typed INPUT_VALIDATION error for a zero selling price', () => {
    const r = calculateProfit(inputs({ sellingPrice: Money.zero() }));
    expect(isErr(r)).toBe(true);
    expect(unwrapErr(r).kind).toBe('INPUT_VALIDATION');
  });
});
