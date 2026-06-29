import { afterAll, beforeAll, beforeEach } from 'vitest';
import { SellerTier } from '@core/types';
import { unwrap } from '@core/errors';
import { createPool, type Pool } from '../../src/db/pool';
import { UserRepository } from '../../src/repositories/UserRepository';
import { SellerProfileRepository } from '../../src/repositories/SellerProfileRepository';
import { FeeProfileRepository } from '../../src/repositories/FeeProfileRepository';

/**
 * Wires up the shared Postgres pool (started by the pgserver daemon, URI in
 * DATABASE_URL), truncating all tables before each test. Returns a `pool()`
 * accessor.
 */
export function useTestDb(): () => Pool {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    throw new Error(
      'DATABASE_URL is not set — start test/setup/pgserver_daemon.py first.',
    );
  }
  let pool: Pool;
  beforeAll(() => {
    pool = createPool(uri);
  });
  afterAll(async () => {
    await pool.end();
  });
  beforeEach(async () => {
    await pool.query(
      'truncate users, seller_profiles, fee_profiles, fee_rules restart identity cascade',
    );
  });
  return () => pool;
}

/** Convenience: create a user, a store, and a fee profile; return their ids. */
export async function seedChain(pool: Pool): Promise<{
  userId: string;
  storeId: string;
  feeProfileId: string;
}> {
  const user = unwrap(await new UserRepository(pool).create({ email: `u${Math.random()}@toko.id` }));
  const store = unwrap(
    await new SellerProfileRepository(pool).create({
      userId: user.id,
      storeName: 'Toko Jaya',
      marketplace: 'SHOPEE',
      sellerTier: SellerTier.REGULAR,
    }),
  );
  const fp = unwrap(
    await new FeeProfileRepository(pool).create({
      sellerProfileId: store.id,
      effectiveDate: '2026-01-01',
      endDate: null,
      sourceReference: 'shopee-id-2026',
    }),
  );
  return { userId: user.id, storeId: store.id, feeProfileId: fp.id };
}
