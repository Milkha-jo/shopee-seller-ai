import { describe, expect, it } from 'vitest';
import { FeeType, Money, Rate, SellerTier } from '@core/types';
import {
  InvariantViolationError,
  err,
  inputValidation,
  isErr,
  isOk,
  ok,
  unwrap,
  unwrapErr,
} from '@core/errors';
import { FeeProfileService, type FeeProfileServiceDeps } from '../src/FeeProfileService';
import type { NewFeeProfileVersion } from '../src/types';
import type { WriteRepos } from '../src/ports';
import { feeProfile, feeRule } from './setup/fakes';
import { useTestServices, seedSeller } from './setup/db';

const RULES = [
  { feeType: FeeType.ADMIN, rate: Rate.of('0.02'), cap: Money.fromRupiah(10000) },
  { feeType: FeeType.SERVICE, rate: Rate.of('0.04'), cap: null },
  { feeType: FeeType.PAYMENT, rate: Rate.of('0.02'), cap: null },
];
const NEW: NewFeeProfileVersion = {
  sellerProfileId: 's1',
  effectiveDate: '2026-01-01',
  endDate: null,
  sourceReference: 'src',
  rules: RULES,
};

const okWriteRepos = (): WriteRepos => ({
  feeProfiles: { create: async () => ok(feeProfile()), delete: async () => ok(true) },
  feeRules: {
    create: async (i) =>
      ok(feeRule(i.feeType, i.rate.toString(), i.cap === null ? null : i.cap.toNumber())),
  },
});

const deps = (over: Partial<FeeProfileServiceDeps> = {}): FeeProfileServiceDeps => ({
  feeProfiles: { findActiveAsOfDate: async () => ok(null), delete: async () => ok(true) },
  feeRules: { list: async () => ok([]) },
  runInTransaction: (fn) => fn(okWriteRepos()),
  ...over,
});

describe('FeeProfileService (unit / fakes)', () => {
  it('createVersion success returns the profile and its rules', async () => {
    const v = unwrap(await new FeeProfileService(deps()).createVersion(NEW));
    expect(v.profile.id).toBe('fp1');
    expect(v.rules.length).toBe(3);
  });

  it('createVersion rolls back when the profile insert fails', async () => {
    const wr = okWriteRepos();
    wr.feeProfiles.create = async () => err(inputValidation('seller_profile_id', 'fk'));
    const svc = new FeeProfileService(deps({ runInTransaction: (fn) => fn(wr) }));
    expect(isErr(await svc.createVersion(NEW))).toBe(true);
  });

  it('createVersion rolls back when a rule insert fails', async () => {
    const wr = okWriteRepos();
    wr.feeRules.create = async () => err(inputValidation('fee_type', 'dup'));
    const svc = new FeeProfileService(deps({ runInTransaction: (fn) => fn(wr) }));
    const e = unwrapErr(await svc.createVersion(NEW));
    expect(e.kind).toBe('INPUT_VALIDATION');
  });

  it('replaceVersion deletes the old version then creates the new (success)', async () => {
    const v = unwrap(await new FeeProfileService(deps()).replaceVersion('old', NEW));
    expect(v.rules.length).toBe(3);
  });

  it('replaceVersion rolls back when the delete fails', async () => {
    const wr = okWriteRepos();
    wr.feeProfiles.delete = async () => err(inputValidation('id', 'boom'));
    const svc = new FeeProfileService(deps({ runInTransaction: (fn) => fn(wr) }));
    expect(isErr(await svc.replaceVersion('old', NEW))).toBe(true);
  });

  it('rethrows an unexpected (non-Rollback) error from the transaction', async () => {
    const wr = okWriteRepos();
    wr.feeProfiles.create = async () => {
      throw new InvariantViolationError('unexpected');
    };
    const svc = new FeeProfileService(deps({ runInTransaction: (fn) => fn(wr) }));
    await expect(svc.createVersion(NEW)).rejects.toBeInstanceOf(InvariantViolationError);
  });

  it('deactivateVersion forwards the repository delete result', async () => {
    expect(unwrap(await new FeeProfileService(deps()).deactivateVersion('fp1'))).toBe(true);
    const svc = new FeeProfileService(
      deps({ feeProfiles: { findActiveAsOfDate: async () => ok(null), delete: async () => err(inputValidation('id', 'x')) } }),
    );
    expect(isErr(await svc.deactivateVersion('fp1'))).toBe(true);
  });

  it('getActiveProfile: propagates a findActive failure', async () => {
    const svc = new FeeProfileService(
      deps({ feeProfiles: { findActiveAsOfDate: async () => err(inputValidation('x', 'y')), delete: async () => ok(true) } }),
    );
    expect(isErr(await svc.getActiveProfile('s1', '2026-06-01'))).toBe(true);
  });

  it('getActiveProfile: returns ok(null) when no active version', async () => {
    const r = await new FeeProfileService(deps()).getActiveProfile('s1', '2026-06-01');
    expect(isOk(r)).toBe(true);
    expect(unwrap(r)).toBeNull();
  });

  it('getActiveProfile: propagates a rules-list failure', async () => {
    const svc = new FeeProfileService(
      deps({
        feeProfiles: { findActiveAsOfDate: async () => ok(feeProfile()), delete: async () => ok(true) },
        feeRules: { list: async () => err(inputValidation('x', 'y')) },
      }),
    );
    expect(isErr(await svc.getActiveProfile('s1', '2026-06-01'))).toBe(true);
  });

  it('getActiveProfile: returns the profile with its rules', async () => {
    const svc = new FeeProfileService(
      deps({
        feeProfiles: { findActiveAsOfDate: async () => ok(feeProfile()), delete: async () => ok(true) },
        feeRules: { list: async () => ok([feeRule(FeeType.ADMIN, '0.02', 10000)]) },
      }),
    );
    const v = unwrap(await svc.getActiveProfile('s1', '2026-06-01'));
    expect(v?.profile.id).toBe('fp1');
    expect(v?.rules.length).toBe(1);
  });
});

describe('FeeProfileService (integration / real DB)', () => {
  const { pool, services } = useTestServices();

  it('createVersion then getActiveProfile round-trips profile + rules', async () => {
    const storeId = await seedSeller(pool());
    unwrap(await services().feeProfile.createVersion({ ...NEW, sellerProfileId: storeId }));
    const v = unwrap(await services().feeProfile.getActiveProfile(storeId, '2026-06-01'));
    expect(v?.rules.length).toBe(3);
    expect(v?.profile.sellerProfileId).toBe(storeId);
  });

  it('selects the correct active version by date and switches on deactivate', async () => {
    const storeId = await seedSeller(pool());
    const fp = services().feeProfile;
    unwrap(await fp.createVersion({ ...NEW, sellerProfileId: storeId, effectiveDate: '2026-01-01', endDate: '2026-03-31', sourceReference: 'v1' }));
    const v2 = unwrap(await fp.createVersion({ ...NEW, sellerProfileId: storeId, effectiveDate: '2026-04-01', endDate: null, sourceReference: 'v2' }));

    expect(unwrap(await fp.getActiveProfile(storeId, '2026-02-15'))?.profile.sourceReference).toBe('v1');
    expect(unwrap(await fp.getActiveProfile(storeId, '2026-05-01'))?.profile.sourceReference).toBe('v2');

    // switch off v2
    expect(unwrap(await fp.deactivateVersion(v2.profile.id))).toBe(true);
    expect(unwrap(await fp.getActiveProfile(storeId, '2026-05-01'))).toBeNull();
  });

  it('rolls back atomically when a version has a duplicate fee type (nothing persisted)', async () => {
    const storeId = await seedSeller(pool());
    const bad = {
      ...NEW,
      sellerProfileId: storeId,
      rules: [
        { feeType: FeeType.ADMIN, rate: Rate.of('0.02'), cap: null },
        { feeType: FeeType.ADMIN, rate: Rate.of('0.03'), cap: null }, // duplicate
      ],
    };
    expect(isErr(await services().feeProfile.createVersion(bad))).toBe(true);
    // atomic: the profile row must not survive the failed rule insert
    expect(unwrap(await services().feeProfile.getActiveProfile(storeId, '2026-02-01'))).toBeNull();
  });
});
