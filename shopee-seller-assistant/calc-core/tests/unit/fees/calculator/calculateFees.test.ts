import { describe, expect, it } from 'vitest';
import {
  FeeType,
  Money,
  Rate,
  type ResolvedFee,
  type ResolvedFeeProfile,
  SellerTier,
} from '../../../../src/types';
import { calculateFees } from '../../../../src/fees/calculator';

function fee(
  feeType: FeeType,
  rate: string,
  cap: Money | null,
): ResolvedFee {
  return { feeType, rate: Rate.of(rate), cap };
}

function profileOf(
  admin: ResolvedFee,
  service: ResolvedFee,
  payment: ResolvedFee,
): ResolvedFeeProfile {
  return {
    sellerTier: SellerTier.REGULAR,
    asOfDate: '2026-06-25',
    admin,
    service,
    payment,
  };
}

// Standard illustrative profile: admin 2% cap 10,000; service 4%; payment 2%.
const standard = profileOf(
  fee(FeeType.ADMIN, '0.02', Money.fromRupiah(10000)),
  fee(FeeType.SERVICE, '0.04', null),
  fee(FeeType.PAYMENT, '0.02', null),
);

describe('calculateFees — golden fixtures', () => {
  it('F1: base 100,000 → 2,000 / 4,000 / 2,000, total 8,000', () => {
    const { feeLines, totalFees } = calculateFees(
      Money.fromRupiah(100000),
      standard,
    );
    expect(feeLines.map((l) => l.appliedFee.toString())).toEqual([
      '2000',
      '4000',
      '2000',
    ]);
    expect(totalFees.toString()).toBe('8000');
    expect(feeLines.every((l) => l.capBound === false)).toBe(true);
  });

  it('F3: effective 80,000 → 1,600 / 3,200 / 1,600, total 6,400', () => {
    const { totalFees } = calculateFees(Money.fromRupiah(80000), standard);
    expect(totalFees.toString()).toBe('6400');
  });

  it('F4: base 84,783 → 1,696 / 3,391 / 1,696, total 6,783 (half-up)', () => {
    const { feeLines, totalFees } = calculateFees(
      Money.fromRupiah(84783),
      standard,
    );
    expect(feeLines.map((l) => l.rawFee.toString())).toEqual([
      '1696',
      '3391',
      '1696',
    ]);
    expect(totalFees.toString()).toBe('6783');
  });

  it('F9: cap-binding admin (cap 1,000) at base 213,830 → total 13,830', () => {
    const capBinding = profileOf(
      fee(FeeType.ADMIN, '0.02', Money.fromRupiah(1000)),
      fee(FeeType.SERVICE, '0.04', null),
      fee(FeeType.PAYMENT, '0.02', null),
    );
    const { feeLines, totalFees } = calculateFees(
      Money.fromRupiah(213830),
      capBinding,
    );
    const admin = feeLines[0]!;
    expect(admin.rawFee.toString()).toBe('4277');
    expect(admin.appliedFee.toString()).toBe('1000');
    expect(admin.capBound).toBe(true);
    expect(totalFees.toString()).toBe('13830');
  });
});

describe('calculateFees — rounding & cap boundaries', () => {
  it('rounds a fee landing on x.5 half-up (away from zero)', () => {
    // 2% of 1,025 = 20.5 → 21
    const profile = profileOf(
      fee(FeeType.ADMIN, '0.02', null),
      fee(FeeType.SERVICE, '0', null),
      fee(FeeType.PAYMENT, '0', null),
    );
    const { feeLines } = calculateFees(Money.fromRupiah(1025), profile);
    expect(feeLines[0]!.rawFee.toString()).toBe('21');
    expect(feeLines[0]!.appliedFee.toString()).toBe('21');
    expect(feeLines[0]!.capBound).toBe(false);
  });

  it('treats rawFee exactly equal to the cap as bound', () => {
    // 2% of 500,000 = 10,000 == cap 10,000
    const { feeLines } = calculateFees(Money.fromRupiah(500000), standard);
    const admin = feeLines[0]!;
    expect(admin.rawFee.toString()).toBe('10000');
    expect(admin.appliedFee.toString()).toBe('10000');
    expect(admin.capBound).toBe(true);
  });

  it('a zero effective price produces zero fees', () => {
    const { feeLines, totalFees } = calculateFees(Money.zero(), standard);
    expect(totalFees.toString()).toBe('0');
    expect(feeLines.every((l) => l.appliedFee.isZero())).toBe(true);
  });
});

describe('calculateFees — line structure', () => {
  it('emits lines in admin, service, payment order with base recorded', () => {
    const { feeLines } = calculateFees(Money.fromRupiah(100000), standard);
    expect(feeLines.map((l) => l.feeType)).toEqual([
      FeeType.ADMIN,
      FeeType.SERVICE,
      FeeType.PAYMENT,
    ]);
    expect(feeLines.every((l) => l.base.toString() === '100000')).toBe(true);
  });
});
