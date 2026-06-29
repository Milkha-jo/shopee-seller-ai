import { describe, expect, it } from 'vitest';
import { FeeType, Money, Rate, ResultStatus } from '@core/types';
import type { ProfitCalculation } from '@core/profit-engine';
import { presentProfit } from '../src/http/present';

const m = (n: number) => Money.fromRupiah(n);

describe('presentProfit', () => {
  it('serializes defined margin/markup and fee lines', () => {
    const calc: ProfitCalculation = {
      effectivePrice: m(100000),
      feeLines: [
        { feeType: FeeType.ADMIN, base: m(100000), rawFee: m(2000), appliedFee: m(2000), capBound: false },
      ],
      totalFees: m(8000),
      netRevenue: m(92000),
      netProfit: m(44000),
      marginPct: Rate.of('0.44'),
      markupPct: Rate.of('0.9'),
      status: ResultStatus.OK,
    };
    const out = presentProfit(calc);
    expect(out.marginPct).toBe('0.44');
    expect(out.markupPct).toBe('0.9');
    expect(out.feeLines[0]!.base).toBe('100000');
  });

  it('serializes undefined margin/markup as null', () => {
    const calc: ProfitCalculation = {
      effectivePrice: m(0),
      feeLines: [],
      totalFees: m(0),
      netRevenue: m(0),
      netProfit: m(0),
      marginPct: undefined,
      markupPct: undefined,
      status: ResultStatus.MARGIN_UNDEFINED,
    };
    const out = presentProfit(calc);
    expect(out.marginPct).toBeNull();
    expect(out.markupPct).toBeNull();
  });
});
