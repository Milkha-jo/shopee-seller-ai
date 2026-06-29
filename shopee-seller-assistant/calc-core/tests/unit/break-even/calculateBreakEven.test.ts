import { describe, expect, it } from 'vitest';
import {
  FeeType,
  Money,
  Rate,
  type ResolvedFee,
  type ResolvedFeeProfile,
  ResultStatus,
  SellerTier,
} from '../../../src/types';
import { calculateBreakEven } from '../../../src/break-even';
import { calculateFees } from '../../../src/fees/calculator';

function fee(feeType: FeeType, rate: string, cap: Money | null): ResolvedFee {
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

const standard = profileOf(
  fee(FeeType.ADMIN, '0.02', Money.fromRupiah(10000)),
  fee(FeeType.SERVICE, '0.04', null),
  fee(FeeType.PAYMENT, '0.02', null),
);

/** Forward profit at a price, via the fee calculator. */
function forwardProfit(
  price: Money,
  totalCost: Money,
  profile: ResolvedFeeProfile,
): Money {
  const { totalFees } = calculateFees(price, profile);
  return price.sub(totalFees).sub(totalCost);
}

describe('calculateBreakEven — required fixtures', () => {
  it('F2: standard profile, cost 48,000 → 52,174 with forward profit in [0,2]', () => {
    const r = calculateBreakEven(Money.fromRupiah(48000), standard);
    expect(r.status).toBe(ResultStatus.OK);
    expect(r.price?.toString()).toBe('52174');
    expect(r.bindingCaps).toEqual([]);

    const profit = forwardProfit(r.price!, Money.fromRupiah(48000), standard);
    expect(profit.gte(Money.zero())).toBe(true);
    expect(profit.lte(Money.fromRupiah(2))).toBe(true);
  });

  it('F9: admin 2% cap 1,000, cost 200,000 → 213,830, binding [ADMIN], profit 0', () => {
    const profile = profileOf(
      fee(FeeType.ADMIN, '0.02', Money.fromRupiah(1000)),
      fee(FeeType.SERVICE, '0.04', null),
      fee(FeeType.PAYMENT, '0.02', null),
    );
    const r = calculateBreakEven(Money.fromRupiah(200000), profile);
    expect(r.status).toBe(ResultStatus.OK);
    expect(r.price?.toString()).toBe('213830');
    expect(r.bindingCaps).toEqual([FeeType.ADMIN]);

    const profit = forwardProfit(r.price!, Money.fromRupiah(200000), profile);
    expect(profit.gte(Money.zero())).toBe(true);
    expect(profit.lte(Money.fromRupiah(2))).toBe(true);
  });

  it('F13: rates summing to >= 100% → NO_SOLUTION', () => {
    const profile = profileOf(
      fee(FeeType.ADMIN, '0.25', null),
      fee(FeeType.SERVICE, '0.50', null),
      fee(FeeType.PAYMENT, '0.30', null),
    );
    const r = calculateBreakEven(Money.fromRupiah(48000), profile);
    expect(r.status).toBe(ResultStatus.NO_SOLUTION);
    expect(r.price).toBeNull();
    expect(r.bindingCaps).toEqual([]);
  });
});

describe('calculateBreakEven — cap behavior', () => {
  it('no caps: nothing binds', () => {
    const profile = profileOf(
      fee(FeeType.ADMIN, '0.02', null),
      fee(FeeType.SERVICE, '0.04', null),
      fee(FeeType.PAYMENT, '0.02', null),
    );
    const r = calculateBreakEven(Money.fromRupiah(48000), profile);
    expect(r.price?.toString()).toBe('52174');
    expect(r.bindingCaps).toEqual([]);
  });

  it('cap enters the loop (admin binds after the first pass)', () => {
    // Same as F9 — admin is uncapped-by-rate in pass 1 then binds.
    const profile = profileOf(
      fee(FeeType.ADMIN, '0.02', Money.fromRupiah(1000)),
      fee(FeeType.SERVICE, '0.04', null),
      fee(FeeType.PAYMENT, '0.02', null),
    );
    const r = calculateBreakEven(Money.fromRupiah(200000), profile);
    expect(r.bindingCaps).toEqual([FeeType.ADMIN]);
  });

  it('cap exits the loop (service binds early then un-binds as E falls)', () => {
    // admin 40% cap 1,000 ; service 4% cap 7,000 ; payment 2% no cap ; cost 100,000.
    // Pass 1 binds {admin, service}; pass 2 drops service; converges to {admin}.
    const profile = profileOf(
      fee(FeeType.ADMIN, '0.40', Money.fromRupiah(1000)),
      fee(FeeType.SERVICE, '0.04', Money.fromRupiah(7000)),
      fee(FeeType.PAYMENT, '0.02', null),
    );
    const r = calculateBreakEven(Money.fromRupiah(100000), profile);
    expect(r.status).toBe(ResultStatus.OK);
    expect(r.price?.toString()).toBe('107447');
    expect(r.bindingCaps).toEqual([FeeType.ADMIN]); // service exited

    const profit = forwardProfit(r.price!, Money.fromRupiah(100000), profile);
    expect(profit.gte(Money.zero())).toBe(true);
    expect(profit.lte(Money.fromRupiah(2))).toBe(true);
  });

  it('zero cap: the fee is always bound and effectively waived', () => {
    const profile = profileOf(
      fee(FeeType.ADMIN, '0.02', Money.zero()),
      fee(FeeType.SERVICE, '0.04', null),
      fee(FeeType.PAYMENT, '0.02', null),
    );
    const r = calculateBreakEven(Money.fromRupiah(48000), profile);
    expect(r.status).toBe(ResultStatus.OK);
    expect(r.price?.toString()).toBe('51064');
    expect(r.bindingCaps).toEqual([FeeType.ADMIN]);

    const profit = forwardProfit(r.price!, Money.fromRupiah(48000), profile);
    expect(profit.gte(Money.zero())).toBe(true);
    expect(profit.lte(Money.fromRupiah(2))).toBe(true);
  });

  it('all caps bind', () => {
    const profile = profileOf(
      fee(FeeType.ADMIN, '0.02', Money.fromRupiah(100)),
      fee(FeeType.SERVICE, '0.04', Money.fromRupiah(100)),
      fee(FeeType.PAYMENT, '0.02', Money.fromRupiah(100)),
    );
    const r = calculateBreakEven(Money.fromRupiah(100000), profile);
    expect(r.status).toBe(ResultStatus.OK);
    expect(r.price?.toString()).toBe('100300');
    expect(r.bindingCaps).toEqual([
      FeeType.ADMIN,
      FeeType.SERVICE,
      FeeType.PAYMENT,
    ]);
  });
});

describe('calculateBreakEven — convergence & monotonicity', () => {
  it('never throws (always converges within the guard) across profiles', () => {
    const cost = Money.fromRupiah(75000);
    expect(() => calculateBreakEven(cost, standard)).not.toThrow();
    expect(() =>
      calculateBreakEven(
        Money.fromRupiah(200000),
        profileOf(
          fee(FeeType.ADMIN, '0.40', Money.fromRupiah(1000)),
          fee(FeeType.SERVICE, '0.04', Money.fromRupiah(7000)),
          fee(FeeType.PAYMENT, '0.02', null),
        ),
      ),
    ).not.toThrow();
  });

  it('profit is monotonic increasing just above break-even', () => {
    const cost = Money.fromRupiah(48000);
    const be = calculateBreakEven(cost, standard).price!;
    const at = forwardProfit(be, cost, standard);
    const above = forwardProfit(be.add(Money.fromRupiah(1000)), cost, standard);
    expect(above.gt(at)).toBe(true);
  });
});
