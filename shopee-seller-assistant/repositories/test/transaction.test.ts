import { describe, expect, it } from 'vitest';
import { unwrap } from '@core/errors';
import { makeTxRunner } from '../src/db/transaction';
import { UserRepository } from '../src/repositories/UserRepository';
import { useTestDb } from './setup/db';

const pool = useTestDb();

describe('makeTxRunner', () => {
  it('commits the work when the callback succeeds', async () => {
    const run = makeTxRunner(pool());
    const id = await run(async (tx) => {
      const u = unwrap(await new UserRepository(tx).create({ email: 'tx-commit@toko.id' }));
      return u.id;
    });
    const found = unwrap(await new UserRepository(pool()).getById(id));
    expect(found?.email).toBe('tx-commit@toko.id');
  });

  it('rolls back and rethrows when the callback throws', async () => {
    const run = makeTxRunner(pool());
    await expect(
      run(async (tx) => {
        await new UserRepository(tx).create({ email: 'tx-rollback@toko.id' });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const count = await pool().query(
      "select count(*)::int as n from users where email = 'tx-rollback@toko.id'",
    );
    expect(count.rows[0].n).toBe(0);
  });
});
