import { describe, expect, it } from 'vitest';
import {
  type DiscountInput,
  DiscountType,
  Money,
  Rate,
} from '../../../src/types';
import { InvariantViolationError } from '../../../src/errors';
import { calculateDiscount } from '../../../src/discount';

const price = Money.fromRupiah(100000);

describe('calculateDiscount — NONE', () => {
  it('produces zero discount and unchanged effective price', () => {
    const r = calculateDiscount(price, {
      type: DiscountType.NONE,
      value: null,
    });
    expect(r.discountAmount.toString()).toBe('0');
    expect(r.effectivePrice.toString()).toBe('100000');
  });
});

describe('calculateDiscount — PERCENTAGE', () => {
  it('applies a fraction and reduces the effective price', () => {
    const r = calculateDiscount(price, {
      type: DiscountType.PERCENTAGE,
      value: Rate.of('0.20'),
    });
    expect(r.discountAmount.toString()).toBe('20000');
    expect(r.effectivePrice.toString()).toBe('80000');
  });

  it('rounds the discount half-up', () => {
    // 20% of 99,999 = 19,999.8 → 20,000
    const r = calculateDiscount(Money.fromRupiah(99999), {
      type: DiscountType.PERCENTAGE,
      value: Rate.of('0.20'),
    });
    expect(r.discountAmount.toString()).toBe('20000');
    expect(r.effectivePrice.toString()).toBe('79999');
  });

  it('clamps a 100% discount to the price (giveaway)', () => {
    const r = calculateDiscount(price, {
      type: DiscountType.PERCENTAGE,
      value: Rate.of('1'),
    });
    expect(r.discountAmount.toString()).toBe('100000');
    expect(r.effectivePrice.toString()).toBe('0');
  });

  it('throws on a non-Rate value (contract breach)', () => {
    const bad: DiscountInput = {
      type: DiscountType.PERCENTAGE,
      value: Money.fromRupiah(5),
    };
    expect(() => calculateDiscount(price, bad)).toThrow(
      InvariantViolationError,
    );
  });
});

describe('calculateDiscount — FLAT', () => {
  it('subtracts a flat value', () => {
    const r = calculateDiscount(price, {
      type: DiscountType.FLAT,
      value: Money.fromRupiah(5000),
    });
    expect(r.discountAmount.toString()).toBe('5000');
    expect(r.effectivePrice.toString()).toBe('95000');
  });

  it('clamps a flat value above the price', () => {
    const r = calculateDiscount(price, {
      type: DiscountType.FLAT,
      value: Money.fromRupiah(200000),
    });
    expect(r.discountAmount.toString()).toBe('100000');
    expect(r.effectivePrice.toString()).toBe('0');
  });

  it('throws on a non-Money value (contract breach)', () => {
    const bad: DiscountInput = {
      type: DiscountType.FLAT,
      value: Rate.of('0.2'),
    };
    expect(() => calculateDiscount(price, bad)).toThrow(
      InvariantViolationError,
    );
  });
});
