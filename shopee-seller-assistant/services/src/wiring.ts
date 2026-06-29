import type { Pool } from '@repo/db/pool';
import { makeTxRunner } from '@repo/db/transaction';
import { SellerProfileRepository } from '@repo/repositories/SellerProfileRepository';
import { FeeProfileRepository } from '@repo/repositories/FeeProfileRepository';
import { FeeRuleRepository } from '@repo/repositories/FeeRuleRepository';
import { CalculationService } from './CalculationService';
import { FeeProfileService } from './FeeProfileService';
import type { RunInTransaction } from './ports';

export interface Services {
  readonly calculation: CalculationService;
  readonly feeProfile: FeeProfileService;
}

/**
 * Build the service layer over a connection pool. This is the only place that
 * knows how repositories and the transaction runner are constructed; the
 * services themselves depend only on ports.
 */
export function makeServices(pool: Pool): Services {
  const sellerProfiles = new SellerProfileRepository(pool);
  const feeProfiles = new FeeProfileRepository(pool);
  const feeRules = new FeeRuleRepository(pool);

  const txRunner = makeTxRunner(pool);
  const runInTransaction: RunInTransaction = (fn) =>
    txRunner((tx) =>
      fn({
        feeProfiles: new FeeProfileRepository(tx),
        feeRules: new FeeRuleRepository(tx),
      }),
    );

  return {
    calculation: new CalculationService({ sellerProfiles, feeProfiles, feeRules }),
    feeProfile: new FeeProfileService({ feeProfiles, feeRules, runInTransaction }),
  };
}
