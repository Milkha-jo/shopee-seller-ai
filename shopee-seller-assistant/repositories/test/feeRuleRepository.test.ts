import { describe, expect, it } from 'vitest';
import { FeeType, Money, Rate } from '@core/types';
import { isErr, unwrap, unwrapErr } from '@core/errors';
import { FeeRuleRepository } from '../src/repositories/FeeRuleRepository';
import { useTestDb, seedChain } from './setup/db';

const pool = useTestDb();

describe('FeeRuleRepository', () => {
  it('create preserves Rate and a capped Money', async () => {
    const { feeProfileId } = await seedChain(pool());
    const repo = new FeeRuleRepository(pool());
    const admin = unwrap(
      await repo.create({
        feeProfileId,
        feeType: FeeType.ADMIN,
        rate: Rate.of('0.02'),
        cap: Money.fromRupiah(10000),
      }),
    );
    expect(admin.feeType).toBe(FeeType.ADMIN);
    expect(admin.rate.toDecimal().toNumber()).toBeCloseTo(0.02, 10);
    expect(admin.cap?.toNumber()).toBe(10000);
  });

  it('create preserves a null cap', async () => {
    const { feeProfileId } = await seedChain(pool());
    const repo = new FeeRuleRepository(pool());
    const svc = unwrap(
      await repo.create({
        feeProfileId,
        feeType: FeeType.SERVICE,
        rate: Rate.of('0.04'),
        cap: null,
      }),
    );
    expect(svc.cap).toBeNull();
  });

  it('list returns the rules for a profile ordered by fee_type', async () => {
    const { feeProfileId } = await seedChain(pool());
    const repo = new FeeRuleRepository(pool());
    await repo.create({ feeProfileId, feeType: FeeType.ADMIN, rate: Rate.of('0.02'), cap: Money.fromRupiah(10000) });
    await repo.create({ feeProfileId, feeType: FeeType.SERVICE, rate: Rate.of('0.04'), cap: null });
    await repo.create({ feeProfileId, feeType: FeeType.PAYMENT, rate: Rate.of('0.02'), cap: null });
    const rules = unwrap(await repo.list(feeProfileId));
    expect(rules.map((r) => r.feeType)).toEqual([FeeType.ADMIN, FeeType.SERVICE, FeeType.PAYMENT]);
    expect(unwrap(await repo.list('00000000-0000-0000-0000-000000000000'))).toEqual([]);
  });

  it('duplicate fee_type in a profile -> INPUT_VALIDATION(fee_type)', async () => {
    const { feeProfileId } = await seedChain(pool());
    const repo = new FeeRuleRepository(pool());
    unwrap(await repo.create({ feeProfileId, feeType: FeeType.ADMIN, rate: Rate.of('0.02'), cap: null }));
    const r = await repo.create({ feeProfileId, feeType: FeeType.ADMIN, rate: Rate.of('0.03'), cap: null });
    expect(isErr(r)).toBe(true);
    const e = unwrapErr(r);
    expect(e.kind).toBe('INPUT_VALIDATION');
    if (e.kind === 'INPUT_VALIDATION') expect(e.field).toBe('fee_type');
  });

  it('rate > 1 -> CHECK violation mapped to INVALID_RATE', async () => {
    const { feeProfileId } = await seedChain(pool());
    const repo = new FeeRuleRepository(pool());
    const r = await repo.create({ feeProfileId, feeType: FeeType.ADMIN, rate: Rate.of('1.5'), cap: null });
    expect(isErr(r)).toBe(true);
    expect(unwrapErr(r).kind).toBe('INVALID_RATE');
  });

  it('negative cap -> CHECK violation mapped to INVALID_CAP', async () => {
    const { feeProfileId } = await seedChain(pool());
    const repo = new FeeRuleRepository(pool());
    const r = await repo.create({
      feeProfileId,
      feeType: FeeType.ADMIN,
      rate: Rate.of('0.02'),
      cap: Money.fromRupiah(-5),
    });
    expect(isErr(r)).toBe(true);
    expect(unwrapErr(r).kind).toBe('INVALID_CAP');
  });

  it('delete returns true/false', async () => {
    const { feeProfileId } = await seedChain(pool());
    const repo = new FeeRuleRepository(pool());
    const rule = unwrap(await repo.create({ feeProfileId, feeType: FeeType.ADMIN, rate: Rate.of('0.02'), cap: null }));
    expect(unwrap(await repo.delete(rule.id))).toBe(true);
    expect(unwrap(await repo.delete(rule.id))).toBe(false);
  });
});
