import { describe, expect, it } from 'vitest';
import { SellerTier } from '@core/types';
import { isErr, isOk, unwrap, unwrapErr } from '@core/errors';
import { UserRepository } from '../src/repositories/UserRepository';
import { SellerProfileRepository } from '../src/repositories/SellerProfileRepository';
import { useTestDb } from './setup/db';

const pool = useTestDb();

async function makeUser(): Promise<string> {
  return unwrap(await new UserRepository(pool()).create({ email: `s${Math.random()}@toko.id` })).id;
}

describe('SellerProfileRepository', () => {
  it('create + getById preserve all fields including the seller_tier enum', async () => {
    const repo = new SellerProfileRepository(pool());
    const userId = await makeUser();
    const created = unwrap(
      await repo.create({
        userId,
        storeName: 'Toko Jaya',
        marketplace: 'SHOPEE',
        sellerTier: SellerTier.STAR_PLUS,
      }),
    );
    expect(created.sellerTier).toBe(SellerTier.STAR_PLUS);
    expect(created.userId).toBe(userId);
    const fetched = unwrap(await repo.getById(created.id));
    expect(fetched).toEqual(created);
  });

  it('list returns a user\'s stores ordered, empty when none', async () => {
    const repo = new SellerProfileRepository(pool());
    const userId = await makeUser();
    expect(unwrap(await repo.list(userId))).toEqual([]);
    await repo.create({ userId, storeName: 'A', marketplace: 'SHOPEE', sellerTier: SellerTier.REGULAR });
    await repo.create({ userId, storeName: 'B', marketplace: 'SHOPEE', sellerTier: SellerTier.MALL });
    const list = unwrap(await repo.list(userId));
    expect(list.length).toBe(2);
    expect(list.map((s) => s.storeName).sort()).toEqual(['A', 'B']);
  });

  it('update applies a partial patch and bumps updated_at via the trigger', async () => {
    const repo = new SellerProfileRepository(pool());
    const userId = await makeUser();
    const s = unwrap(
      await repo.create({ userId, storeName: 'Old', marketplace: 'SHOPEE', sellerTier: SellerTier.REGULAR }),
    );
    await new Promise((r) => setTimeout(r, 5));
    const updated = unwrap(await repo.update(s.id, { storeName: 'New', marketplace: 'SHOPEE', sellerTier: SellerTier.STAR }));
    expect(updated?.storeName).toBe('New');
    expect(updated?.sellerTier).toBe(SellerTier.STAR);
    expect(updated?.marketplace).toBe('SHOPEE'); // untouched (coalesce)
    expect(updated!.updatedAt >= s.updatedAt).toBe(true);
    // partial patch that omits store_name and seller_tier (covers the coalesce null sides)
    const partial = unwrap(await repo.update(s.id, { marketplace: 'SHOPEE' }));
    expect(partial?.storeName).toBe('New');
    expect(partial?.sellerTier).toBe(SellerTier.STAR);
  });

  it('update returns ok(null) for a missing id', async () => {
    const repo = new SellerProfileRepository(pool());
    const r = await repo.update('00000000-0000-0000-0000-000000000000', { storeName: 'X' });
    expect(isOk(r)).toBe(true);
    expect(unwrap(r)).toBeNull();
  });

  it('missing user_id -> FK violation mapped to INPUT_VALIDATION(user_id)', async () => {
    const repo = new SellerProfileRepository(pool());
    const r = await repo.create({
      userId: '00000000-0000-0000-0000-000000000000',
      storeName: 'X',
      marketplace: 'SHOPEE',
      sellerTier: SellerTier.REGULAR,
    });
    expect(isErr(r)).toBe(true);
    const e = unwrapErr(r);
    expect(e.kind).toBe('INPUT_VALIDATION');
    if (e.kind === 'INPUT_VALIDATION') expect(e.field).toBe('user_id');
  });

  it('delete returns true when removed, false when absent', async () => {
    const repo = new SellerProfileRepository(pool());
    const userId = await makeUser();
    const s = unwrap(
      await repo.create({ userId, storeName: 'D', marketplace: 'SHOPEE', sellerTier: SellerTier.REGULAR }),
    );
    expect(unwrap(await repo.delete(s.id))).toBe(true);
    expect(unwrap(await repo.delete(s.id))).toBe(false);
  });

  it('deleting the parent user cascades to the store', async () => {
    const userRepo = new UserRepository(pool());
    const repo = new SellerProfileRepository(pool());
    const userId = await makeUser();
    const s = unwrap(
      await repo.create({ userId, storeName: 'C', marketplace: 'SHOPEE', sellerTier: SellerTier.REGULAR }),
    );
    expect(unwrap(await userRepo.delete(userId))).toBe(true);
    expect(unwrap(await repo.getById(s.id))).toBeNull();
  });
});
