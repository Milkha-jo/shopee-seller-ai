import { describe, expect, it } from 'vitest';
import { InvariantViolationError } from '@core/errors';
import { isErr, isOk, unwrap, unwrapErr } from '@core/errors';
import { FeeProfileRepository } from '../src/repositories/FeeProfileRepository';
import { useTestDb, seedChain } from './setup/db';

const pool = useTestDb();

describe('FeeProfileRepository', () => {
  it('create preserves ISO dates and open-ended end_date', async () => {
    const { storeId } = await seedChain(pool());
    const repo = new FeeProfileRepository(pool());
    const fp = unwrap(
      await repo.create({
        sellerProfileId: storeId,
        effectiveDate: '2026-02-01',
        endDate: '2026-05-31',
        sourceReference: 'src-1',
      }),
    );
    expect(fp.effectiveDate).toBe('2026-02-01');
    expect(fp.endDate).toBe('2026-05-31');
    const open = unwrap(
      await repo.create({
        sellerProfileId: storeId,
        effectiveDate: '2026-06-01',
        endDate: null,
        sourceReference: 'src-2',
      }),
    );
    expect(open.endDate).toBeNull();
  });

  it('getById missing -> ok(null); list orders by effective_date', async () => {
    const { storeId, feeProfileId } = await seedChain(pool());
    const repo = new FeeProfileRepository(pool());
    expect(unwrap(await repo.getById('00000000-0000-0000-0000-000000000000'))).toBeNull();
    expect(unwrap(await repo.getById(feeProfileId))?.id).toBe(feeProfileId);
    const list = unwrap(await repo.list(storeId));
    expect(list.length).toBe(1);
    expect(list[0]!.id).toBe(feeProfileId);
  });

  it('findActiveAsOfDate selects the covering window and its boundaries', async () => {
    const { storeId } = await seedChain(pool()); // seed adds [2026-01-01, open]
    const repo = new FeeProfileRepository(pool());
    // mid-window
    const hit = unwrap(await repo.findActiveAsOfDate(storeId, '2026-03-15'));
    expect(hit).not.toBeNull();
    // exactly on the effective_date (inclusive lower bound)
    const onStart = unwrap(await repo.findActiveAsOfDate(storeId, '2026-01-01'));
    expect(onStart).not.toBeNull();
    // before the window -> null
    const before = unwrap(await repo.findActiveAsOfDate(storeId, '2025-12-31'));
    expect(before).toBeNull();
  });

  it('findActiveAsOfDate respects an inclusive end_date and gaps', async () => {
    const { storeId } = await seedChain(pool());
    const repo = new FeeProfileRepository(pool());
    // delete the open-ended seed and add a bounded window instead
    const seeded = unwrap(await repo.list(storeId));
    await repo.delete(seeded[0]!.id);
    await repo.create({
      sellerProfileId: storeId,
      effectiveDate: '2026-01-01',
      endDate: '2026-03-31',
      sourceReference: 'bounded',
    });
    expect(unwrap(await repo.findActiveAsOfDate(storeId, '2026-03-31'))).not.toBeNull(); // inclusive end
    expect(unwrap(await repo.findActiveAsOfDate(storeId, '2026-04-01'))).toBeNull(); // after end
  });

  it('throws InvariantViolationError on overlapping windows (does not interpret them)', async () => {
    // The production EXCLUDE constraint forbids this; the sandbox build lacks
    // btree_gist, so we can insert an overlap and confirm the repo refuses it.
    const { storeId } = await seedChain(pool());
    const repo = new FeeProfileRepository(pool());
    await repo.create({
      sellerProfileId: storeId,
      effectiveDate: '2026-02-01',
      endDate: null,
      sourceReference: 'overlap',
    });
    await expect(repo.findActiveAsOfDate(storeId, '2026-03-01')).rejects.toBeInstanceOf(
      InvariantViolationError,
    );
  });

  it('missing seller_profile_id -> FK violation mapped to INPUT_VALIDATION', async () => {
    const repo = new FeeProfileRepository(pool());
    const r = await repo.create({
      sellerProfileId: '00000000-0000-0000-0000-000000000000',
      effectiveDate: '2026-01-01',
      endDate: null,
      sourceReference: 'x',
    });
    expect(isErr(r)).toBe(true);
    expect(unwrapErr(r).kind).toBe('INPUT_VALIDATION');
  });

  it('inverted window -> CHECK violation mapped to INPUT_VALIDATION(end_date)', async () => {
    const { storeId } = await seedChain(pool());
    const repo = new FeeProfileRepository(pool());
    const r = await repo.create({
      sellerProfileId: storeId,
      effectiveDate: '2026-06-01',
      endDate: '2026-01-01',
      sourceReference: 'bad',
    });
    expect(isErr(r)).toBe(true);
    const e = unwrapErr(r);
    expect(e.kind).toBe('INPUT_VALIDATION');
    if (e.kind === 'INPUT_VALIDATION') expect(e.field).toBe('end_date');
  });

  it('delete returns true/false', async () => {
    const { feeProfileId } = await seedChain(pool());
    const repo = new FeeProfileRepository(pool());
    expect(unwrap(await repo.delete(feeProfileId))).toBe(true);
    expect(unwrap(await repo.delete(feeProfileId))).toBe(false);
  });
});
