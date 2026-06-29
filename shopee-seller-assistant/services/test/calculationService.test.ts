import { describe, expect, it } from 'vitest';
import { DiscountType, FeeType, Money, Rate, SellerTier } from '@core/types';
import { inputValidation, isErr, isOk, unwrap, unwrapErr } from '@core/errors';
import { CalculationService, type CalculationServiceDeps } from '../src/CalculationService';
import type { ProfitRequest } from '../src/types';
import {
  feeProfile,
  feeRule,
  sellerProfile,
  standardRules,
} from './setup/fakes';
import { useTestServices, seedSeller } from './setup/db';

const F1_REQUEST: ProfitRequest = {
  sellerProfileId: 's1',
  asOfDate: '2026-06-01',
  sellingPrice: Money.fromRupiah(100000),
  costInputs: { productCost: Money.fromRupiah(45000), packagingCost: Money.fromRupiah(3000) },
  discount: { type: DiscountType.NONE, value: null },
};

const happyDeps = (over: Partial<CalculationServiceDeps> = {}): CalculationServiceDeps => ({
  sellerProfiles: { getById: async () => ({ ok: true, value: sellerProfile() }) },
  feeProfiles: { findActiveAsOfDate: async () => ({ ok: true, value: feeProfile() }) },
  feeRules: { list: async () => ({ ok: true, value: standardRules() }) },
  ...over,
});

describe('CalculationService (unit / fakes)', () => {
  it('computes profit and maps fees correctly (golden fixture F1)', async () => {
    const svc = new CalculationService(happyDeps());
    const r = unwrap(await svc.calculateProfit(F1_REQUEST));
    expect(r.netProfit.toNumber()).toBe(44000);
    expect(r.totalFees.toNumber()).toBe(8000);
    expect(r.feeLines.length).toBe(3);
    expect(r.marginPct?.toString()).toBe('0.44');
  });

  it('propagates a repository failure loading the seller', async () => {
    const svc = new CalculationService(
      happyDeps({ sellerProfiles: { getById: async () => ({ ok: false, error: inputValidation('db', 'down') }) } }),
    );
    expect(isErr(await svc.calculateProfit(F1_REQUEST))).toBe(true);
  });

  it('missing seller -> INPUT_VALIDATION(sellerProfileId)', async () => {
    const svc = new CalculationService(
      happyDeps({ sellerProfiles: { getById: async () => ({ ok: true, value: null }) } }),
    );
    const e = unwrapErr(await svc.calculateProfit(F1_REQUEST));
    expect(e.kind).toBe('INPUT_VALIDATION');
    if (e.kind === 'INPUT_VALIDATION') expect(e.field).toBe('sellerProfileId');
  });

  it('propagates a repository failure loading the active fee profile', async () => {
    const svc = new CalculationService(
      happyDeps({ feeProfiles: { findActiveAsOfDate: async () => ({ ok: false, error: inputValidation('db', 'down') }) } }),
    );
    expect(isErr(await svc.calculateProfit(F1_REQUEST))).toBe(true);
  });

  it('missing active fee profile -> INPUT_VALIDATION(feeProfile)', async () => {
    const svc = new CalculationService(
      happyDeps({ feeProfiles: { findActiveAsOfDate: async () => ({ ok: true, value: null }) } }),
    );
    const e = unwrapErr(await svc.calculateProfit(F1_REQUEST));
    expect(e.kind).toBe('INPUT_VALIDATION');
    if (e.kind === 'INPUT_VALIDATION') expect(e.field).toBe('feeProfile');
  });

  it('propagates a repository failure listing fee rules', async () => {
    const svc = new CalculationService(
      happyDeps({ feeRules: { list: async () => ({ ok: false, error: inputValidation('db', 'down') }) } }),
    );
    expect(isErr(await svc.calculateProfit(F1_REQUEST))).toBe(true);
  });

  it('propagates a calc-core resolver failure (incomplete rules -> MISSING_FEE_TYPE)', async () => {
    const svc = new CalculationService(
      happyDeps({ feeRules: { list: async () => ({ ok: true, value: [feeRule(FeeType.ADMIN, '0.02', 10000)] }) } }),
    );
    const e = unwrapErr(await svc.calculateProfit(F1_REQUEST));
    expect(e.kind).toBe('MISSING_FEE_TYPE');
  });

  it('propagates a calc-core profit-engine failure (sellingPrice must be > 0)', async () => {
    const svc = new CalculationService(happyDeps());
    const e = unwrapErr(
      await svc.calculateProfit({ ...F1_REQUEST, sellingPrice: Money.fromRupiah(0) }),
    );
    expect(e.kind).toBe('INPUT_VALIDATION');
    if (e.kind === 'INPUT_VALIDATION') expect(e.field).toBe('sellingPrice');
  });
});

describe('CalculationService (integration / real DB + wiring)', () => {
  const { pool, services } = useTestServices();

  it('end-to-end profit through repositories + calc-core (F1)', async () => {
    const storeId = await seedSeller(pool(), SellerTier.REGULAR);
    unwrap(
      await services().feeProfile.createVersion({
        sellerProfileId: storeId,
        effectiveDate: '2026-01-01',
        endDate: null,
        sourceReference: 'shopee-id-2026',
        rules: [
          { feeType: FeeType.ADMIN, rate: Rate.of('0.02'), cap: Money.fromRupiah(10000) },
          { feeType: FeeType.SERVICE, rate: Rate.of('0.04'), cap: null },
          { feeType: FeeType.PAYMENT, rate: Rate.of('0.02'), cap: null },
        ],
      }),
    );
    const r = unwrap(
      await services().calculation.calculateProfit({ ...F1_REQUEST, sellerProfileId: storeId }),
    );
    expect(r.netProfit.toNumber()).toBe(44000);
    expect(r.marginPct?.toString()).toBe('0.44');
  });

  it('no active fee profile for the seller -> error', async () => {
    const storeId = await seedSeller(pool());
    const res = await services().calculation.calculateProfit({ ...F1_REQUEST, sellerProfileId: storeId });
    expect(isOk(res)).toBe(false);
  });
});
