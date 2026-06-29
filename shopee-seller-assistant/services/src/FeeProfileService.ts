import {
  type CalcError,
  type Result,
  err,
  isErr,
  ok,
} from '@core/errors';
import type { IsoDate } from '@core/types';
import type {
  ActiveFeeProfileReader,
  FeeProfileDeleter,
  FeeRuleLister,
  RunInTransaction,
  WriteRepos,
} from './ports';
import type {
  FeeProfileVersion,
  NewFeeProfileVersion,
} from './types';

export interface FeeProfileServiceDeps {
  readonly feeProfiles: ActiveFeeProfileReader & FeeProfileDeleter;
  readonly feeRules: FeeRuleLister;
  readonly runInTransaction: RunInTransaction;
}

/** Internal signal to roll back a transaction while carrying a typed error. */
class Rollback {
  constructor(readonly error: CalcError) {}
}

/**
 * Coordinates fee-profile versions. Pure repository orchestration — no
 * financial calculations. Multi-row writes (a profile plus its rules) run
 * atomically via the injected transaction port.
 */
export class FeeProfileService {
  constructor(private readonly deps: FeeProfileServiceDeps) {}

  /** Create (activate) a new version: the profile window plus all its rules. */
  async createVersion(
    input: NewFeeProfileVersion,
  ): Promise<Result<FeeProfileVersion, CalcError>> {
    return this.writeVersion(null, input);
  }

  /** Replace (update) a version: delete the old one and create a new one,
   *  atomically. */
  async replaceVersion(
    feeProfileId: string,
    input: NewFeeProfileVersion,
  ): Promise<Result<FeeProfileVersion, CalcError>> {
    return this.writeVersion(feeProfileId, input);
  }

  /** Deactivate a version by removing it (its rules cascade). */
  async deactivateVersion(feeProfileId: string): Promise<Result<boolean, CalcError>> {
    return this.deps.feeProfiles.delete(feeProfileId);
  }

  /** Retrieve the active version (profile + rules) for a seller as of a date. */
  async getActiveProfile(
    sellerProfileId: string,
    asOfDate: IsoDate,
  ): Promise<Result<FeeProfileVersion | null, CalcError>> {
    const fpRes = await this.deps.feeProfiles.findActiveAsOfDate(
      sellerProfileId,
      asOfDate,
    );
    if (isErr(fpRes)) return fpRes;
    const profile = fpRes.value;
    if (profile === null) return ok(null);

    const rulesRes = await this.deps.feeRules.list(profile.id);
    if (isErr(rulesRes)) return rulesRes;
    return ok({ profile, rules: rulesRes.value });
  }

  // Shared atomic write used by create and replace. When `deleteId` is set the
  // existing version is removed first, then the new profile and rules are
  // inserted — all in one transaction.
  private async writeVersion(
    deleteId: string | null,
    input: NewFeeProfileVersion,
  ): Promise<Result<FeeProfileVersion, CalcError>> {
    try {
      const version = await this.deps.runInTransaction(
        async (repos: WriteRepos): Promise<FeeProfileVersion> => {
          if (deleteId !== null) {
            const del = await repos.feeProfiles.delete(deleteId);
            if (isErr(del)) throw new Rollback(del.error);
          }
          const fp = await repos.feeProfiles.create({
            sellerProfileId: input.sellerProfileId,
            effectiveDate: input.effectiveDate,
            endDate: input.endDate,
            sourceReference: input.sourceReference,
          });
          if (isErr(fp)) throw new Rollback(fp.error);

          const rules = [];
          for (const r of input.rules) {
            const rr = await repos.feeRules.create({
              feeProfileId: fp.value.id,
              feeType: r.feeType,
              rate: r.rate,
              cap: r.cap,
            });
            if (isErr(rr)) throw new Rollback(rr.error);
            rules.push(rr.value);
          }
          return { profile: fp.value, rules };
        },
      );
      return ok(version);
    } catch (e) {
      if (e instanceof Rollback) return err(e.error);
      throw e; // unexpected (e.g. InvariantViolationError) — propagate
    }
  }
}
