import { describe, expect, it } from 'vitest';
import {
  type FeeRateRow,
  FeeType,
  Money,
  Rate,
} from '../../../src/types';
import { isErr, isOk, unwrapErr } from '../../../src/errors';
import { validateFeeRows } from '../../../src/validation';

function row(
  feeType: FeeType,
  rate: string,
  opts: {
    cap?: Money | null;
    effectiveDate?: string;
    endDate?: string | null;
  } = {},
): FeeRateRow {
  return {
    feeType,
    rate: Rate.of(rate),
    cap: opts.cap ?? null,
    effectiveDate: opts.effectiveDate ?? '2026-05-01',
    endDate: opts.endDate ?? null,
    sourceRef: 'src',
  };
}

const completeProfile: FeeRateRow[] = [
  row(FeeType.ADMIN, '0.02', { cap: Money.fromRupiah(10000) }),
  row(FeeType.SERVICE, '0.04'),
  row(FeeType.PAYMENT, '0.02'),
];

describe('validateFeeRows — completeness (G-3)', () => {
  it('accepts a complete three-fee profile', () => {
    expect(isOk(validateFeeRows(completeProfile))).toBe(true);
  });

  it('rejects a profile missing PAYMENT', () => {
    const r = validateFeeRows([
      row(FeeType.ADMIN, '0.02'),
      row(FeeType.SERVICE, '0.04'),
    ]);
    expect(isErr(r)).toBe(true);
    const e = unwrapErr(r);
    expect(e.kind).toBe('MISSING_FEE_TYPE');
    if (e.kind === 'MISSING_FEE_TYPE') expect(e.feeType).toBe('PAYMENT');
  });
});

describe('validateFeeRows — per-row validity', () => {
  it('rejects a rate above 1', () => {
    const r = validateFeeRows([
      row(FeeType.ADMIN, '1.5'),
      row(FeeType.SERVICE, '0.04'),
      row(FeeType.PAYMENT, '0.02'),
    ]);
    expect(isErr(r)).toBe(true);
    expect(unwrapErr(r).kind).toBe('INVALID_RATE');
  });

  it('rejects a negative cap', () => {
    const r = validateFeeRows([
      row(FeeType.ADMIN, '0.02', { cap: Money.fromRupiah(-1) }),
      row(FeeType.SERVICE, '0.04'),
      row(FeeType.PAYMENT, '0.02'),
    ]);
    expect(isErr(r)).toBe(true);
    expect(unwrapErr(r).kind).toBe('INVALID_CAP');
  });

  it('rejects a malformed effective date', () => {
    const r = validateFeeRows([
      row(FeeType.ADMIN, '0.02', { effectiveDate: '2026-13-01' }),
      row(FeeType.SERVICE, '0.04'),
      row(FeeType.PAYMENT, '0.02'),
    ]);
    expect(isErr(r)).toBe(true);
    expect(unwrapErr(r).kind).toBe('INPUT_VALIDATION');
  });

  it('rejects endDate before effectiveDate', () => {
    const r = validateFeeRows([
      row(FeeType.ADMIN, '0.02', {
        effectiveDate: '2026-05-01',
        endDate: '2026-04-01',
      }),
      row(FeeType.SERVICE, '0.04'),
      row(FeeType.PAYMENT, '0.02'),
    ]);
    expect(isErr(r)).toBe(true);
    expect(unwrapErr(r).kind).toBe('INPUT_VALIDATION');
  });
});

describe('validateFeeRows — overlap (G-4)', () => {
  it('accepts non-overlapping historical windows for one fee type', () => {
    const r = validateFeeRows([
      row(FeeType.ADMIN, '0.02', {
        effectiveDate: '2026-01-01',
        endDate: '2026-04-30',
      }),
      row(FeeType.ADMIN, '0.025', { effectiveDate: '2026-05-01' }),
      row(FeeType.SERVICE, '0.04'),
      row(FeeType.PAYMENT, '0.02'),
    ]);
    expect(isOk(r)).toBe(true);
  });

  it('rejects overlapping windows for one fee type', () => {
    const r = validateFeeRows([
      row(FeeType.ADMIN, '0.02', {
        effectiveDate: '2026-01-01',
        endDate: '2026-06-30',
      }),
      row(FeeType.ADMIN, '0.025', { effectiveDate: '2026-05-01' }),
      row(FeeType.SERVICE, '0.04'),
      row(FeeType.PAYMENT, '0.02'),
    ]);
    expect(isErr(r)).toBe(true);
    const e = unwrapErr(r);
    expect(e.kind).toBe('OVERLAPPING_FEE_WINDOW');
    if (e.kind === 'OVERLAPPING_FEE_WINDOW') expect(e.feeType).toBe('ADMIN');
  });

  it('treats touching windows (end == next start) as overlapping', () => {
    const r = validateFeeRows([
      row(FeeType.ADMIN, '0.02', {
        effectiveDate: '2026-01-01',
        endDate: '2026-05-01',
      }),
      row(FeeType.ADMIN, '0.025', { effectiveDate: '2026-05-01' }),
      row(FeeType.SERVICE, '0.04'),
      row(FeeType.PAYMENT, '0.02'),
    ]);
    expect(isErr(r)).toBe(true);
    expect(unwrapErr(r).kind).toBe('OVERLAPPING_FEE_WINDOW');
  });
});
