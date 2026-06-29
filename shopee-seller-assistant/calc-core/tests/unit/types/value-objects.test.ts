import { describe, expect, it } from 'vitest';
import {
  type BreakEvenResult,
  type CostInputs,
  type DiscountInput,
  DiscountType,
  type FeeLine,
  type FeeRateRow,
  FeeType,
  Money,
  type ProfitInputs,
  type ProfitResult,
  Rate,
  type RecommendInput,
  type RecommendResult,
  RecommendationMode,
  type ResolvedFee,
  type ResolvedFeeProfile,
  ResultStatus,
  SellerTier,
} from '../../../src/types';

const adminFee: ResolvedFee = {
  feeType: FeeType.ADMIN,
  rate: Rate.of('0.02'),
  cap: Money.fromRupiah(10000),
};
const serviceFee: ResolvedFee = {
  feeType: FeeType.SERVICE,
  rate: Rate.of('0.04'),
  cap: null,
};
const paymentFee: ResolvedFee = {
  feeType: FeeType.PAYMENT,
  rate: Rate.of('0.02'),
  cap: null,
};

const profile: ResolvedFeeProfile = {
  sellerTier: SellerTier.REGULAR,
  asOfDate: '2026-06-25',
  admin: adminFee,
  service: serviceFee,
  payment: paymentFee,
};

describe('fee data shapes', () => {
  it('FeeRateRow holds its fields', () => {
    const row: FeeRateRow = {
      feeType: FeeType.ADMIN,
      rate: Rate.of('0.02'),
      cap: Money.fromRupiah(10000),
      effectiveDate: '2026-05-01',
      endDate: null,
      sourceRef: 'src-admin-2026',
    };
    expect(row.feeType).toBe(FeeType.ADMIN);
    expect(row.endDate).toBeNull();
    expect(row.cap?.toString()).toBe('10000');
  });

  it('ResolvedFee and ResolvedFeeProfile compose', () => {
    expect(profile.admin.rate.toString()).toBe('0.02');
    expect(profile.service.cap).toBeNull();
    expect(profile.sellerTier).toBe(SellerTier.REGULAR);
  });

  it('FeeLine holds computed-line fields', () => {
    const line: FeeLine = {
      feeType: FeeType.ADMIN,
      base: Money.fromRupiah(100000),
      rawFee: Money.fromRupiah(2000),
      appliedFee: Money.fromRupiah(2000),
      capBound: false,
    };
    expect(line.capBound).toBe(false);
    expect(line.appliedFee.toString()).toBe('2000');
  });
});

describe('input shapes', () => {
  const costInputs: CostInputs = {
    productCost: Money.fromRupiah(45000),
    packagingCost: Money.fromRupiah(3000),
  };

  it('CostInputs holds the two cost fields', () => {
    expect(costInputs.productCost.toString()).toBe('45000');
    expect(costInputs.packagingCost.toString()).toBe('3000');
  });

  it('DiscountInput supports NONE / PERCENTAGE / FLAT', () => {
    const none: DiscountInput = { type: DiscountType.NONE, value: null };
    const pct: DiscountInput = {
      type: DiscountType.PERCENTAGE,
      value: Rate.of('0.20'),
    };
    const flat: DiscountInput = {
      type: DiscountType.FLAT,
      value: Money.fromRupiah(5000),
    };
    expect(none.value).toBeNull();
    expect((pct.value as Rate).toString()).toBe('0.2');
    expect((flat.value as Money).toString()).toBe('5000');
  });

  it('ProfitInputs composes cost, price, discount, profile', () => {
    const inputs: ProfitInputs = {
      costInputs,
      sellingPrice: Money.fromRupiah(100000),
      discount: { type: DiscountType.NONE, value: null },
      sellerTier: SellerTier.REGULAR,
      asOfDate: '2026-06-25',
      profile,
    };
    expect(inputs.sellingPrice.toString()).toBe('100000');
    expect(inputs.profile.payment.feeType).toBe(FeeType.PAYMENT);
  });

  it('RecommendInput carries mode-specific optional targets', () => {
    const a: RecommendInput = {
      mode: RecommendationMode.TARGET_PROFIT,
      costInputs,
      sellerTier: SellerTier.REGULAR,
      asOfDate: '2026-06-25',
      targetProfit: Money.fromRupiah(30000),
      profile,
    };
    expect(a.mode).toBe(RecommendationMode.TARGET_PROFIT);
    expect(a.targetProfit?.toString()).toBe('30000');
    expect(a.targetMargin).toBeUndefined();
  });
});

describe('output shapes', () => {
  it('ProfitResult holds metrics with optional margin/markup', () => {
    const result: ProfitResult = {
      effectivePrice: Money.fromRupiah(100000),
      feeLines: [],
      totalFees: Money.fromRupiah(8000),
      netRevenue: Money.fromRupiah(92000),
      netProfit: Money.fromRupiah(44000),
      marginPct: Rate.of('0.44'),
      markupPct: Rate.of('0.9167'),
      breakEvenPrice: Money.fromRupiah(52174),
      status: ResultStatus.OK,
    };
    expect(result.netProfit.toString()).toBe('44000');
    expect(result.marginPct?.toString()).toBe('0.44');
    expect(result.status).toBe(ResultStatus.OK);
  });

  it('ProfitResult permits absent margin (undefined case)', () => {
    const result: ProfitResult = {
      effectivePrice: Money.zero(),
      feeLines: [],
      totalFees: Money.zero(),
      netRevenue: Money.zero(),
      netProfit: Money.fromRupiah(-48000),
      breakEvenPrice: Money.fromRupiah(52174),
      status: ResultStatus.MARGIN_UNDEFINED,
    };
    expect(result.marginPct).toBeUndefined();
    expect(result.status).toBe(ResultStatus.MARGIN_UNDEFINED);
  });

  it('BreakEvenResult holds a price or NO_SOLUTION', () => {
    const ok: BreakEvenResult = {
      status: ResultStatus.OK,
      price: Money.fromRupiah(52174),
      bindingCaps: [],
    };
    const none: BreakEvenResult = {
      status: ResultStatus.NO_SOLUTION,
      price: null,
      bindingCaps: [],
    };
    expect(ok.price?.toString()).toBe('52174');
    expect(none.price).toBeNull();
  });

  it('RecommendResult carries feasibility and optional ceiling', () => {
    const infeasible: RecommendResult = {
      recommendedPrice: null,
      roundTrip: null,
      breakEvenFloor: Money.fromRupiah(52174),
      feasibility: ResultStatus.INFEASIBLE_CEILING,
      ceiling: Rate.of('0.94'),
      status: ResultStatus.INFEASIBLE_CEILING,
    };
    expect(infeasible.recommendedPrice).toBeNull();
    expect(infeasible.ceiling?.toString()).toBe('0.94');
  });
});
