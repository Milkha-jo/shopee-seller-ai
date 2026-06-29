import { describe, expect, it } from 'vitest';
import {
  DiscountType,
  Money,
  Rate,
  RecommendationMode,
  ResultStatus,
} from '@core/types';
import { inputValidation, isErr, unwrap, unwrapErr } from '@core/errors';
import { PricingService, type PricingServiceDeps } from '../src/PricingService';
import { feeProfile, sellerProfile, standardRules } from './setup/fakes';

const COSTS = {
  productCost: Money.fromRupiah(45000),
  packagingCost: Money.fromRupiah(3000),
};

const happyDeps = (over: Partial<PricingServiceDeps> = {}): PricingServiceDeps => ({
  sellerProfiles: { getById: async () => ({ ok: true, value: sellerProfile() }) },
  feeProfiles: { findActiveAsOfDate: async () => ({ ok: true, value: feeProfile() }) },
  feeRules: { list: async () => ({ ok: true, value: standardRules() }) },
  ...over,
});

describe('PricingService — break-even (unit / fakes)', () => {
  it('solves a positive break-even price for the standard profile', async () => {
    const svc = new PricingService(happyDeps());
    const be = unwrap(
      await svc.calculateBreakEven({
        sellerProfileId: 's1',
        asOfDate: '2026-06-01',
        costInputs: COSTS,
      }),
    );
    expect(be.status).toBe(ResultStatus.OK);
    expect(be.price).not.toBeNull();
    // cost 48000 with ~8% effective fees => floor strictly above cost.
    expect(be.price!.toNumber()).toBeGreaterThan(48000);
  });

  it('missing seller -> INPUT_VALIDATION(sellerProfileId)', async () => {
    const svc = new PricingService(
      happyDeps({ sellerProfiles: { getById: async () => ({ ok: true, value: null }) } }),
    );
    const e = unwrapErr(
      await svc.calculateBreakEven({
        sellerProfileId: 's1',
        asOfDate: '2026-06-01',
        costInputs: COSTS,
      }),
    );
    expect(e.kind).toBe('INPUT_VALIDATION');
    if (e.kind === 'INPUT_VALIDATION') expect(e.field).toBe('sellerProfileId');
  });

  it('propagates a repository failure', async () => {
    const svc = new PricingService(
      happyDeps({
        feeRules: { list: async () => ({ ok: false, error: inputValidation('db', 'down') }) },
      }),
    );
    expect(
      isErr(
        await svc.calculateBreakEven({
          sellerProfileId: 's1',
          asOfDate: '2026-06-01',
          costInputs: COSTS,
        }),
      ),
    ).toBe(true);
  });

  it('no active fee profile -> INPUT_VALIDATION(feeProfile)', async () => {
    const svc = new PricingService(
      happyDeps({
        feeProfiles: { findActiveAsOfDate: async () => ({ ok: true, value: null }) },
      }),
    );
    const e = unwrapErr(
      await svc.calculateBreakEven({
        sellerProfileId: 's1',
        asOfDate: '2026-06-01',
        costInputs: COSTS,
      }),
    );
    expect(e.kind).toBe('INPUT_VALIDATION');
    if (e.kind === 'INPUT_VALIDATION') expect(e.field).toBe('feeProfile');
  });

  it('propagates a seller-load failure', async () => {
    const svc = new PricingService(
      happyDeps({
        sellerProfiles: {
          getById: async () => ({ ok: false, error: inputValidation('db', 'down') }),
        },
      }),
    );
    expect(
      isErr(
        await svc.recommend({
          sellerProfileId: 's1',
          asOfDate: '2026-06-01',
          mode: RecommendationMode.MIN_VIABLE,
          costInputs: COSTS,
        }),
      ),
    ).toBe(true);
  });
});

describe('PricingService — recommend (unit / fakes)', () => {
  it('MIN_VIABLE recommends a list price at or above the break-even floor', async () => {
    const svc = new PricingService(happyDeps());
    const r = unwrap(
      await svc.recommend({
        sellerProfileId: 's1',
        asOfDate: '2026-06-01',
        mode: RecommendationMode.MIN_VIABLE,
        costInputs: COSTS,
        safetyBuffer: Rate.of('0.1'),
      }),
    );
    expect(r.status).toBe(ResultStatus.OK);
    expect(r.recommendedPrice).not.toBeNull();
    expect(r.recommendedPrice!.toNumber()).toBeGreaterThanOrEqual(
      r.breakEvenFloor.toNumber(),
    );
  });

  it('TARGET_PROFIT round-trips to the requested profit within tolerance', async () => {
    const svc = new PricingService(happyDeps());
    const r = unwrap(
      await svc.recommend({
        sellerProfileId: 's1',
        asOfDate: '2026-06-01',
        mode: RecommendationMode.TARGET_PROFIT,
        costInputs: COSTS,
        targetProfit: Money.fromRupiah(20000),
        plannedDiscount: { type: DiscountType.NONE, value: null },
      }),
    );
    expect(r.status).toBe(ResultStatus.OK);
    expect(r.roundTrip).not.toBeNull();
    expect(Math.abs(r.roundTrip!.netProfit.toNumber() - 20000)).toBeLessThanOrEqual(2);
  });

  it('TARGET_MARGIN above the uncapped ceiling -> INFEASIBLE_CEILING', async () => {
    const svc = new PricingService(happyDeps());
    const r = unwrap(
      await svc.recommend({
        sellerProfileId: 's1',
        asOfDate: '2026-06-01',
        mode: RecommendationMode.TARGET_MARGIN,
        costInputs: COSTS,
        targetMargin: Rate.of('0.99'),
      }),
    );
    expect(r.feasibility).toBe(ResultStatus.INFEASIBLE_CEILING);
    expect(r.recommendedPrice).toBeNull();
  });

  it('missing target for the mode -> INPUT_VALIDATION', async () => {
    const svc = new PricingService(happyDeps());
    const e = unwrapErr(
      await svc.recommend({
        sellerProfileId: 's1',
        asOfDate: '2026-06-01',
        mode: RecommendationMode.TARGET_PROFIT,
        costInputs: COSTS,
      }),
    );
    expect(e.kind).toBe('INPUT_VALIDATION');
  });
});
