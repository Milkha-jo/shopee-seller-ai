import { describe, expect, it } from 'vitest';
import { Money, Rate } from '../../../src/types';

describe('Rate', () => {
  it('constructs from an exact decimal string and stringifies', () => {
    expect(Rate.of('0.02').toString()).toBe('0.02');
    expect(Rate.of('0.0425').toString()).toBe('0.0425');
  });

  it('exposes an exact decimal copy', () => {
    expect(Rate.of('0.04').toDecimal().toString()).toBe('0.04');
  });

  it('feeds Money.mul to produce an exact fee (value-object fitness)', () => {
    // 2% of 100,000 → 2,000 (fixture F1)
    const fee = Money.fromRupiah(100000).mul(Rate.of('0.02').toDecimal());
    expect(fee.toString()).toBe('2000');
  });

  it('does not perform range validation (that lives in the validation module)', () => {
    // Out-of-range values are accepted here by design; no throw.
    expect(Rate.of('1.5').toString()).toBe('1.5');
  });
});
