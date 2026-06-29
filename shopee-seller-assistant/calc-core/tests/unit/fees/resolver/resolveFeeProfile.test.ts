import { describe, expect, it } from 'vitest';
import {
  type FeeRateRow,
  FeeType,
  Money,
  Rate,
  SellerTier,
} from '../../../../src/types';
import { isErr, isOk, unwrap, unwrapErr } from '../../../../src/errors';
import { resolveFeeProfile } from '../../../../src/fees/resolver';

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

const complete: FeeRateRow[] = [
  row(FeeType.ADMIN, '0.02', { cap: Money.fromRupiah(10000) }),
  row(FeeType.SERVICE, '0.04'),
  row(FeeType.PAYMENT, '0.02'),
];

describe('resolveFeeProfile — success', () => {
  it('resolves a complete, effective profile', () => {
    const r = resolveFeeProfile(SellerTier.REGULAR, '2026-06-25', complete);
    expect(isOk(r)).toBe(true);
    const p = unwrap(r);
    expect(p.sellerTier).toBe(SellerTier.REGULAR);
    expect(p.asOfDate).toBe('2026-06-25');
    expect(p.admin.rate.toString()).toBe('0.02');
    expect(p.admin.cap?.toString()).toBe('10000');
    expect(p.service.cap).toBeNull();
    expect(p.payment.feeType).toBe(FeeType.PAYMENT);
  });

  it('selects the historically-correct row among non-overlapping windows', () => {
    const rows: FeeRateRow[] = [
      row(FeeType.ADMIN, '0.02', {
        effectiveDate: '2026-01-01',
        endDate: '2026-04-30',
      }),
      row(FeeType.ADMIN, '0.025', { effectiveDate: '2026-05-01' }),
      row(FeeType.SERVICE, '0.04', { effectiveDate: '2026-01-01' }),
      row(FeeType.PAYMENT, '0.02', { effectiveDate: '2026-01-01' }),
    ];
    expect(unwrap(resolveFeeProfile(SellerTier.REGULAR, '2026-06-25', rows)).admin.rate.toString()).toBe('0.025');
    expect(unwrap(resolveFeeProfile(SellerTier.REGULAR, '2026-03-15', rows)).admin.rate.toString()).toBe('0.02');
  });

  it('treats window boundaries inclusively', () => {
    const rows: FeeRateRow[] = [
      row(FeeType.ADMIN, '0.02', {
        effectiveDate: '2026-05-01',
        endDate: '2026-05-31',
      }),
      row(FeeType.SERVICE, '0.04'),
      row(FeeType.PAYMENT, '0.02'),
    ];
    // start boundary
    expect(isOk(resolveFeeProfile(SellerTier.REGULAR, '2026-05-01', rows))).toBe(true);
    // end boundary
    expect(isOk(resolveFeeProfile(SellerTier.REGULAR, '2026-05-31', rows))).toBe(true);
    // just outside
    expect(isErr(resolveFeeProfile(SellerTier.REGULAR, '2026-06-01', rows))).toBe(true);
  });
});

describe('resolveFeeProfile — config errors (delegated to validation)', () => {
  it('rejects a profile missing a fee type (G-3)', () => {
    const r = resolveFeeProfile(SellerTier.REGULAR, '2026-06-25', [
      row(FeeType.ADMIN, '0.02'),
      row(FeeType.SERVICE, '0.04'),
    ]);
    expect(unwrapErr(r).kind).toBe('MISSING_FEE_TYPE');
  });

  it('halts on overlapping windows (G-4)', () => {
    const r = resolveFeeProfile(SellerTier.REGULAR, '2026-06-25', [
      row(FeeType.ADMIN, '0.02', {
        effectiveDate: '2026-01-01',
        endDate: '2026-12-31',
      }),
      row(FeeType.ADMIN, '0.025', { effectiveDate: '2026-06-01' }),
      row(FeeType.SERVICE, '0.04'),
      row(FeeType.PAYMENT, '0.02'),
    ]);
    expect(unwrapErr(r).kind).toBe('OVERLAPPING_FEE_WINDOW');
  });
});

describe('resolveFeeProfile — no effective fee', () => {
  it('returns NO_EFFECTIVE_FEE when a present fee type is not effective on the date', () => {
    const rows: FeeRateRow[] = [
      // admin exists but expired before the date
      row(FeeType.ADMIN, '0.02', {
        effectiveDate: '2026-01-01',
        endDate: '2026-03-31',
      }),
      row(FeeType.SERVICE, '0.04'),
      row(FeeType.PAYMENT, '0.02'),
    ];
    const r = resolveFeeProfile(SellerTier.REGULAR, '2026-06-25', rows);
    expect(isErr(r)).toBe(true);
    const e = unwrapErr(r);
    expect(e.kind).toBe('NO_EFFECTIVE_FEE');
    if (e.kind === 'NO_EFFECTIVE_FEE') {
      expect(e.feeType).toBe('ADMIN');
      expect(e.date).toBe('2026-06-25');
    }
  });
});

describe('resolveFeeProfile — input guards', () => {
  it('rejects an unknown seller tier', () => {
    const r = resolveFeeProfile('GOLD' as SellerTier, '2026-06-25', complete);
    expect(unwrapErr(r).kind).toBe('INPUT_VALIDATION');
  });

  it('rejects a malformed asOfDate', () => {
    const r = resolveFeeProfile(SellerTier.REGULAR, '2026-13-01', complete);
    expect(unwrapErr(r).kind).toBe('INPUT_VALIDATION');
  });
});
