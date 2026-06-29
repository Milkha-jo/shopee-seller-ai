import { afterAll, beforeAll, beforeEach } from 'vitest';
import { SellerTier } from '@core/types';
import { unwrap } from '@core/errors';
import { createPool, type Pool } from '@repo/db/pool';
import { UserRepository } from '@repo/repositories/UserRepository';
import { SellerProfileRepository } from '@repo/repositories/SellerProfileRepository';
import { makeServices, type Services } from '../../src/wiring';

export function useTestServices(): { pool: () => Pool; services: () => Services } {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    throw new Error('DATABASE_URL not set — start test/setup/pgserver_daemon.py first.');
  }
  let pool: Pool;
  let services: Services;
  beforeAll(() => {
    pool = createPool(uri);
    services = makeServices(pool);
  });
  afterAll(async () => {
    await pool.end();
  });
  beforeEach(async () => {
    await pool.query(
      'truncate users, seller_profiles, fee_profiles, fee_rules restart identity cascade',
    );
  });
  return { pool: () => pool, services: () => services };
}

/** Create a user + seller profile; return the store id and tier. */
export async function seedSeller(
  pool: Pool,
  tier: SellerTier = SellerTier.REGULAR,
): Promise<string> {
  const user = unwrap(await new UserRepository(pool).create({ email: `u${Math.random()}@toko.id` }));
  const store = unwrap(
    await new SellerProfileRepository(pool).create({
      userId: user.id,
      storeName: 'Toko Jaya',
      marketplace: 'SHOPEE',
      sellerTier: tier,
    }),
  );
  return store.id;
}
