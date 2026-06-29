import { describe, expect, it } from 'vitest';
import {
  DiscountType,
  FeeType,
  RecommendationMode,
  ResultStatus,
  SellerTier,
} from '../../../src/types';

describe('SellerTier', () => {
  it('has exactly the four blueprint tiers', () => {
    expect(Object.values(SellerTier)).toEqual([
      'REGULAR',
      'STAR',
      'STAR_PLUS',
      'MALL',
    ]);
  });
});

describe('FeeType', () => {
  it('has exactly admin, service, payment', () => {
    expect(Object.values(FeeType)).toEqual(['ADMIN', 'SERVICE', 'PAYMENT']);
  });
});

describe('DiscountType', () => {
  it('has none, percentage, flat (flat discounts remain valid)', () => {
    expect(Object.values(DiscountType)).toEqual([
      'NONE',
      'PERCENTAGE',
      'FLAT',
    ]);
  });
});

describe('RecommendationMode', () => {
  it('has the four recommend modes A/B/C/D', () => {
    expect(Object.values(RecommendationMode)).toEqual([
      'TARGET_PROFIT',
      'TARGET_MARGIN',
      'TARGET_MARKUP',
      'MIN_VIABLE',
    ]);
  });
});

describe('ResultStatus', () => {
  it('has every blueprint status', () => {
    expect(Object.values(ResultStatus)).toEqual([
      'OK',
      'MARGIN_UNDEFINED',
      'MARKUP_UNDEFINED',
      'NO_SOLUTION',
      'INFEASIBLE_CEILING',
      'CONFIG_ERROR',
      'INPUT_ERROR',
    ]);
  });

  it('members are self-named strings (stable serialization)', () => {
    expect(SellerTier.REGULAR).toBe('REGULAR');
    expect(FeeType.PAYMENT).toBe('PAYMENT');
    expect(ResultStatus.INFEASIBLE_CEILING).toBe('INFEASIBLE_CEILING');
  });
});
