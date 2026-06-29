import { describe, expect, it } from 'vitest';
import { isErr, isOk, unwrap, unwrapErr } from '@core/errors';
import { UserRepository } from '../src/repositories/UserRepository';
import { useTestDb } from './setup/db';

const pool = useTestDb();

describe('UserRepository', () => {
  it('create + getById round-trips (mapping correctness)', async () => {
    const repo = new UserRepository(pool());
    const created = unwrap(await repo.create({ email: 'a@toko.id' }));
    expect(created.email).toBe('a@toko.id');
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(typeof created.createdAt).toBe('string');

    const fetched = unwrap(await repo.getById(created.id));
    expect(fetched).toEqual(created);
  });

  it('getById returns ok(null) for a missing row', async () => {
    const repo = new UserRepository(pool());
    const r = await repo.getById('00000000-0000-0000-0000-000000000000');
    expect(isOk(r)).toBe(true);
    expect(unwrap(r)).toBeNull();
  });

  it('duplicate email -> INPUT_VALIDATION on email', async () => {
    const repo = new UserRepository(pool());
    unwrap(await repo.create({ email: 'dup@toko.id' }));
    const r = await repo.create({ email: 'dup@toko.id' });
    expect(isErr(r)).toBe(true);
    const e = unwrapErr(r);
    expect(e.kind).toBe('INPUT_VALIDATION');
    if (e.kind === 'INPUT_VALIDATION') expect(e.field).toBe('email');
  });

  it('delete returns true when removed, false when absent', async () => {
    const repo = new UserRepository(pool());
    const u = unwrap(await repo.create({ email: 'del@toko.id' }));
    expect(unwrap(await repo.delete(u.id))).toBe(true);
    expect(unwrap(await repo.delete(u.id))).toBe(false);
    expect(unwrap(await repo.getById(u.id))).toBeNull();
  });

  it('works inside an externally-managed transaction that is rolled back', async () => {
    const client = await pool().connect();
    try {
      await client.query('begin');
      const repo = new UserRepository(client);
      const u = unwrap(await repo.create({ email: 'tx@toko.id' }));
      expect(u.email).toBe('tx@toko.id');
      await client.query('rollback');
    } finally {
      client.release();
    }
    // committed pool sees nothing
    const after = await new UserRepository(pool()).getById(
      '00000000-0000-0000-0000-000000000000',
    );
    expect(isOk(after)).toBe(true);
    const count = await pool().query('select count(*)::int as n from users');
    expect(count.rows[0].n).toBe(0);
  });
});
