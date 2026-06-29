import { describe, expect, it } from 'vitest';
import {
  type CostInputs,
  type DiscountInput,
  DiscountType,
  Money,
  type ProfitInputs,
  Rate,
  type RecommendInput,
  RecommendationMode,
  type ResolvedFeeProfile,
  SellerTier,
  FeeType,
} from '../../../src/types';
import { isErr, isOk, unwrapErr } from '../../../src/errors';
import {
  validateAsOfDate,
  validateCostInputs,
  validateDiscount,
  validateProfitInputs,
  validateRecommendInput,
  validateRecommendationMode,
  validateSellerTier,
  validateSellingPrice,
} from '../../../src/validation';

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

describe('validateSellerTier', () => {
  it('accepts a known tier', () => {
    expect(isOk(validateSellerTier(SellerTier.REGULAR))).toBe(true);
  });
  it('rejects an unknown tier', () => {
    const r = validateSellerTier('GOLD' as SellerTier);
    expect(isErr(r)).toBe(true);
    expect(unwrapErr(r).kind).toBe('INPUT_VALIDATION');
  });
});

describe('validateRecommendationMode', () => {
  it('accepts a known mode', () => {
    expect(isOk(validateRecommendationMode(RecommendationMode.MIN_VIABLE))).toBe(
      true,
    );
  });
  it('rejects an unknown mode', () => {
    expect(isErr(validateRecommendationMode('X' as RecommendationMode))).toBe(
      true,
    );
  });
});

describe('validateAsOfDate', () => {
  it('accepts a real date', () => {
    expect(isOk(validateAsOfDate('2026-06-25'))).toBe(true);
  });
  it('rejects a malformed date', () => {
    expect(isErr(validateAsOfDate('25-06-2026'))).toBe(true);
  });
  it('rejects an out-of-range month', () => {
    expect(isErr(validateAsOfDate('2026-13-01'))).toBe(true);
  });
  it('rejects an impossible day', () => {
    expect(isErr(validateAsOfDate('2026-02-30'))).toBe(true);
  });
});

describe('validateCostInputs', () => {
  it('accepts non-negative costs', () => {
    expect(isOk(validateCostInputs(cost))).toBe(true);
  });
  it('rejects negative product cost', () => {
    const r = validateCostInputs({
      productCost: Money.fromRupiah(-1),
      packagingCost: Money.zero(),
    });
    expect(isErr(r)).toBe(true);
    expect(unwrapErr(r).kind).toBe('INPUT_VALIDATION');
  });
  it('rejects negative packaging cost', () => {
    expect(
      isErr(
        validateCostInputs({
          productCost: Money.zero(),
          packagingCost: Money.fromRupiah(-1),
        }),
      ),
    ).toBe(true);
  });
});

describe('validateSellingPrice', () => {
  it('accepts a positive price', () => {
    expect(isOk(validateSellingPrice(Money.fromRupiah(100000)))).toBe(true);
  });
  it('rejects zero', () => {
    expect(isErr(validateSellingPrice(Money.zero()))).toBe(true);
  });
  it('rejects a negative price', () => {
    expect(isErr(validateSellingPrice(Money.fromRupiah(-1)))).toBe(true);
  });
});

describe('validateDiscount', () => {
  it('NONE accepts a null value', () => {
    expect(isOk(validateDiscount({ type: DiscountType.NONE, value: null }))).toBe(
      true,
    );
  });
  it('NONE rejects a non-null value', () => {
    expect(
      isErr(
        validateDiscount({
          type: DiscountType.NONE,
          value: Money.fromRupiah(1),
        }),
      ),
    ).toBe(true);
  });
  it('PERCENTAGE accepts fractions in [0,1] (boundaries included)', () => {
    for (const v of ['0', '0.2', '1']) {
      expect(
        isOk(
          validateDiscount({ type: DiscountType.PERCENTAGE, value: Rate.of(v) }),
        ),
      ).toBe(true);
    }
  });
  it('PERCENTAGE rejects > 1', () => {
    expect(
      isErr(
        validateDiscount({
          type: DiscountType.PERCENTAGE,
          value: Rate.of('1.5'),
        }),
      ),
    ).toBe(true);
  });
  it('PERCENTAGE rejects a Money value (wrong type)', () => {
    const d: DiscountInput = {
      type: DiscountType.PERCENTAGE,
      value: Money.fromRupiah(5),
    };
    expect(isErr(validateDiscount(d))).toBe(true);
  });
  it('FLAT accepts a value within the selling price', () => {
    expect(
      isOk(
        validateDiscount(
          { type: DiscountType.FLAT, value: Money.fromRupiah(5000) },
          Money.fromRupiah(100000),
        ),
      ),
    ).toBe(true);
  });
  it('FLAT rejects a negative value', () => {
    expect(
      isErr(
        validateDiscount({
          type: DiscountType.FLAT,
          value: Money.fromRupiah(-1),
        }),
      ),
    ).toBe(true);
  });
  it('FLAT rejects a value above the selling price', () => {
    expect(
      isErr(
        validateDiscount(
          { type: DiscountType.FLAT, value: Money.fromRupiah(200000) },
          Money.fromRupiah(100000),
        ),
      ),
    ).toBe(true);
  });
  it('FLAT without a price bound accepts any non-negative value', () => {
    expect(
      isOk(
        validateDiscount({
          type: DiscountType.FLAT,
          value: Money.fromRupiah(200000),
        }),
      ),
    ).toBe(true);
  });
});

describe('validateProfitInputs', () => {
  const base: ProfitInputs = {
    costInputs: cost,
    sellingPrice: Money.fromRupiah(100000),
    discount: { type: DiscountType.NONE, value: null },
    sellerTier: SellerTier.REGULAR,
    asOfDate: '2026-06-25',
    profile,
  };

  it('accepts a fully valid set', () => {
    expect(isOk(validateProfitInputs(base))).toBe(true);
  });
  it('rejects a zero selling price', () => {
    expect(
      isErr(validateProfitInputs({ ...base, sellingPrice: Money.zero() })),
    ).toBe(true);
  });
  it('rejects an unknown tier', () => {
    expect(
      isErr(
        validateProfitInputs({ ...base, sellerTier: 'GOLD' as SellerTier }),
      ),
    ).toBe(true);
  });
});

describe('validateRecommendInput', () => {
  const base = {
    costInputs: cost,
    sellerTier: SellerTier.REGULAR,
    asOfDate: '2026-06-25',
    profile,
  };

  it('TARGET_PROFIT accepts a present target (negative allowed)', () => {
    const a: RecommendInput = {
      ...base,
      mode: RecommendationMode.TARGET_PROFIT,
      targetProfit: Money.fromRupiah(-100),
    };
    expect(isOk(validateRecommendInput(a))).toBe(true);
  });
  it('TARGET_PROFIT rejects a missing target', () => {
    const a: RecommendInput = {
      ...base,
      mode: RecommendationMode.TARGET_PROFIT,
    };
    expect(isErr(validateRecommendInput(a))).toBe(true);
  });

  it('TARGET_MARGIN accepts >= 0 and rejects negative / missing', () => {
    expect(
      isOk(
        validateRecommendInput({
          ...base,
          mode: RecommendationMode.TARGET_MARGIN,
          targetMargin: Rate.of('0.30'),
        }),
      ),
    ).toBe(true);
    expect(
      isErr(
        validateRecommendInput({
          ...base,
          mode: RecommendationMode.TARGET_MARGIN,
          targetMargin: Rate.of('-0.1'),
        }),
      ),
    ).toBe(true);
    expect(
      isErr(
        validateRecommendInput({
          ...base,
          mode: RecommendationMode.TARGET_MARGIN,
        }),
      ),
    ).toBe(true);
  });

  it('TARGET_MARKUP requires target >= 0 and cost > 0', () => {
    expect(
      isOk(
        validateRecommendInput({
          ...base,
          mode: RecommendationMode.TARGET_MARKUP,
          targetMarkup: Rate.of('0.5'),
        }),
      ),
    ).toBe(true);
    // cost == 0 → rejected
    expect(
      isErr(
        validateRecommendInput({
          ...base,
          costInputs: {
            productCost: Money.zero(),
            packagingCost: Money.zero(),
          },
          mode: RecommendationMode.TARGET_MARKUP,
          targetMarkup: Rate.of('0.5'),
        }),
      ),
    ).toBe(true);
    // negative markup → rejected
    expect(
      isErr(
        validateRecommendInput({
          ...base,
          mode: RecommendationMode.TARGET_MARKUP,
          targetMarkup: Rate.of('-0.5'),
        }),
      ),
    ).toBe(true);
  });

  it('MIN_VIABLE accepts with/without buffer, rejects negative buffer', () => {
    expect(
      isOk(
        validateRecommendInput({
          ...base,
          mode: RecommendationMode.MIN_VIABLE,
        }),
      ),
    ).toBe(true);
    expect(
      isOk(
        validateRecommendInput({
          ...base,
          mode: RecommendationMode.MIN_VIABLE,
          safetyBuffer: Rate.of('0.10'),
        }),
      ),
    ).toBe(true);
    expect(
      isErr(
        validateRecommendInput({
          ...base,
          mode: RecommendationMode.MIN_VIABLE,
          safetyBuffer: Rate.of('-0.10'),
        }),
      ),
    ).toBe(true);
  });

  it('rejects an invalid planned discount', () => {
    expect(
      isErr(
        validateRecommendInput({
          ...base,
          mode: RecommendationMode.MIN_VIABLE,
          plannedDiscount: {
            type: DiscountType.PERCENTAGE,
            value: Rate.of('1.5'),
          },
        }),
      ),
    ).toBe(true);
  });
});
