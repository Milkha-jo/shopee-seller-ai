import type { Result } from '@core/errors';
import type { IsoDate } from '@core/types';
import type { FeeProfile, FeeRule, SellerProfile } from '@repo/domain';

// Narrow ports the services depend on. Real repositories satisfy these
// structurally; tests can supply deterministic fakes. Services depend on these
// — never on pg or SQL.

export interface SellerProfileReader {
  getById(id: string): Promise<Result<SellerProfile | null>>;
}

export interface ActiveFeeProfileReader {
  findActiveAsOfDate(
    sellerProfileId: string,
    asOfDate: IsoDate,
  ): Promise<Result<FeeProfile | null>>;
}

export interface FeeRuleLister {
  list(feeProfileId: string): Promise<Result<FeeRule[]>>;
}

export interface FeeProfileDeleter {
  delete(id: string): Promise<Result<boolean>>;
}

// Write-side repos handed to a transactional unit of work.
export interface FeeProfileWriter {
  create(input: {
    sellerProfileId: string;
    effectiveDate: IsoDate;
    endDate: IsoDate | null;
    sourceReference: string;
  }): Promise<Result<FeeProfile>>;
  delete(id: string): Promise<Result<boolean>>;
}

export interface FeeRuleWriter {
  create(input: {
    feeProfileId: string;
    feeType: FeeRule['feeType'];
    rate: FeeRule['rate'];
    cap: FeeRule['cap'];
  }): Promise<Result<FeeRule>>;
}

export interface WriteRepos {
  feeProfiles: FeeProfileWriter;
  feeRules: FeeRuleWriter;
}

/** Runs `fn` with transaction-scoped write repos; commits on success, rolls
 *  back if `fn` throws. Provided by the persistence layer (composition root). */
export type RunInTransaction = <T>(fn: (repos: WriteRepos) => Promise<T>) => Promise<T>;
