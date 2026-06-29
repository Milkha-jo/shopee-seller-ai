import { describe, expect, it } from 'vitest';
import { InvariantViolationError } from '../../../src/errors';
import { D, Money } from '../../../src/money';

describe('Money construction', () => {
  it('builds from an integer rupiah number', () => {
    expect(Money.fromRupiah(48000).toString()).toBe('48000');
  });

  it('builds from an exact decimal string', () => {
    expect(Money.fromRupiah('100.5').toString()).toBe('100.5');
  });

  it('rejects a non-integer number (avoids float ingress)', () => {
    expect(() => Money.fromRupiah(0.1)).toThrow(InvariantViolationError);
  });

  it('rejects NaN / non-finite', () => {
    expect(() => Money.fromRupiah(Number.NaN)).toThrow(InvariantViolationError);
    expect(() => Money.fromRupiah('not-a-number')).toThrow(
      InvariantViolationError,
    );
  });

  it('of() accepts Money / number / string', () => {
    expect(Money.of(Money.fromRupiah(5)).toString()).toBe('5');
    expect(Money.of(5).toString()).toBe('5');
    expect(Money.of('5').toString()).toBe('5');
  });

  it('fromDecimal remains the explicit escape hatch for raw Decimals', () => {
    expect(Money.fromDecimal(new D('5')).toString()).toBe('5');
  });

  it('zero()', () => {
    expect(Money.zero().isZero()).toBe(true);
  });
});

describe('Money arithmetic (no floating point)', () => {
  it('0.1 + 0.2 === 0.3 exactly (the classic float trap)', () => {
    const r = Money.fromRupiah('0.1').add(Money.fromRupiah('0.2'));
    expect(r.toString()).toBe('0.3');
  });

  it('adds and subtracts whole rupiah', () => {
    expect(Money.fromRupiah(45000).add(Money.fromRupiah(3000)).toString()).toBe(
      '48000',
    );
    expect(
      Money.fromRupiah(100000).sub(Money.fromRupiah(8000)).toString(),
    ).toBe('92000');
  });

  it('multiplies by a fractional rate given as a string (exact)', () => {
    // 2% admin fee on 100,000 → 2,000 (F1)
    const raw = Money.fromRupiah(100000).mul('0.02');
    expect(raw.toString()).toBe('2000');
    // 4% service on 84,783 → 3391.32 raw, then half-up → 3391 (F4)
    const svc = Money.fromRupiah(84783).mul('0.04');
    expect(svc.toString()).toBe('3391.32');
    expect(svc.roundHalfUp().toString()).toBe('3391');
  });

  it('multiplies by an integer factor', () => {
    expect(Money.fromRupiah(2000).mul(3).toString()).toBe('6000');
  });

  it('rejects a fractional number factor (must use string)', () => {
    expect(() => Money.fromRupiah(100000).mul(0.02)).toThrow(
      InvariantViolationError,
    );
  });

  it('neg and abs', () => {
    expect(Money.fromRupiah(48000).neg().toString()).toBe('-48000');
    expect(Money.fromRupiah(48000).neg().abs().toString()).toBe('48000');
  });
});

describe('Money rounding', () => {
  it('roundHalfUp to whole rupiah', () => {
    expect(Money.fromRupiah('1043.48').roundHalfUp().toString()).toBe('1043');
    expect(Money.fromRupiah('1043.5').roundHalfUp().toString()).toBe('1044');
  });

  it('ceil to whole rupiah', () => {
    expect(Money.fromRupiah('52173.91').ceil().toString()).toBe('52174');
  });
});

describe('Money comparisons & predicates', () => {
  const a = Money.fromRupiah(1696);
  const cap = Money.fromRupiah(10000);

  it('min picks the smaller (fee vs cap pattern)', () => {
    expect(a.min(cap).toString()).toBe('1696');
    expect(cap.min(a).toString()).toBe('1696');
  });

  it('max picks the larger', () => {
    expect(a.max(cap).toString()).toBe('10000');
  });

  it('ordering helpers', () => {
    expect(a.lt(cap)).toBe(true);
    expect(cap.gt(a)).toBe(true);
    expect(a.lte(a)).toBe(true);
    expect(a.gte(a)).toBe(true);
    expect(a.eq(Money.fromRupiah(1696))).toBe(true);
  });

  it('isNegative / isZero / isInteger', () => {
    expect(Money.fromRupiah(-48000).isNegative()).toBe(true);
    expect(Money.zero().isNegative()).toBe(false);
    expect(Money.zero().isZero()).toBe(true);
    expect(Money.fromRupiah('100.5').isInteger()).toBe(false);
    expect(Money.fromRupiah(100).isInteger()).toBe(true);
  });
});

describe('Money serialisation', () => {
  it('toNumber works for whole rupiah', () => {
    expect(Money.fromRupiah(44000).toNumber()).toBe(44000);
  });

  it('toNumber throws on a fractional amount (must round first)', () => {
    expect(() => Money.fromRupiah('100.5').toNumber()).toThrow(
      InvariantViolationError,
    );
  });

  it('toDecimal returns an independent copy', () => {
    const m = Money.fromRupiah(10);
    const d = m.toDecimal();
    expect(d.toString()).toBe('10');
  });
});

describe('Money determinism', () => {
  it('identical operations produce identical output', () => {
    const run = () =>
      Money.fromRupiah(84783)
        .mul('0.02')
        .roundHalfUp()
        .add(Money.fromRupiah(48000))
        .toString();
    expect(run()).toBe(run());
    expect(run()).toBe('49696');
  });
});
