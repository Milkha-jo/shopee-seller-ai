import { describe, expect, it } from 'vitest';
import { FeeType, Money, Rate, SellerTier } from '@core/types';
import { isErr } from '@core/errors';
import type { Queryable } from '../src/db/types';
import { UserRepository } from '../src/repositories/UserRepository';
import { SellerProfileRepository } from '../src/repositories/SellerProfileRepository';
import { FeeProfileRepository } from '../src/repositories/FeeProfileRepository';
import { FeeRuleRepository } from '../src/repositories/FeeRuleRepository';

// A Queryable that always rejects with a recognised pg error, so every method's
// catch → err(mapDbError) branch is exercised without a live database.
const boom: Queryable = {
  // eslint-disable-next-line @typescript-eslint/require-await
  async query() {
    throw { code: '23505', constraint: 'x' };
  },
};

describe('repository catch branches map DB errors to err()', () => {
  it('UserRepository', async () => {
    const r = new UserRepository(boom);
    expect(isErr(await r.create({ email: 'e' }))).toBe(true);
    expect(isErr(await r.getById('id'))).toBe(true);
    expect(isErr(await r.delete('id'))).toBe(true);
  });

  it('SellerProfileRepository', async () => {
    const r = new SellerProfileRepository(boom);
    expect(isErr(await r.create({ userId: 'u', storeName: 's', marketplace: 'SHOPEE', sellerTier: SellerTier.REGULAR }))).toBe(true);
    expect(isErr(await r.getById('id'))).toBe(true);
    expect(isErr(await r.list('u'))).toBe(true);
    expect(isErr(await r.update('id', { storeName: 'x' }))).toBe(true);
    expect(isErr(await r.delete('id'))).toBe(true);
  });

  it('FeeProfileRepository (incl. findActiveAsOfDate non-invariant error path)', async () => {
    const r = new FeeProfileRepository(boom);
    expect(isErr(await r.create({ sellerProfileId: 's', effectiveDate: '2026-01-01', endDate: null, sourceReference: 'x' }))).toBe(true);
    expect(isErr(await r.getById('id'))).toBe(true);
    expect(isErr(await r.list('s'))).toBe(true);
    expect(isErr(await r.findActiveAsOfDate('s', '2026-01-01'))).toBe(true);
    expect(isErr(await r.delete('id'))).toBe(true);
  });

  it('FeeRuleRepository', async () => {
    const r = new FeeRuleRepository(boom);
    expect(isErr(await r.create({ feeProfileId: 'f', feeType: FeeType.ADMIN, rate: Rate.of('0.02'), cap: Money.fromRupiah(1) }))).toBe(true);
    expect(isErr(await r.list('f'))).toBe(true);
    expect(isErr(await r.delete('id'))).toBe(true);
  });
});
