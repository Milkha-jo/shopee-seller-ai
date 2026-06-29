import { createPool, type Pool } from '@repo/db/pool';
import { UserRepository } from '@repo/repositories/UserRepository';
import { SellerProfileRepository } from '@repo/repositories/SellerProfileRepository';
import { FeeProfileRepository } from '@repo/repositories/FeeProfileRepository';
import { FeeRuleRepository } from '@repo/repositories/FeeRuleRepository';
import { makeServices } from '@svc/wiring';
import { AuthService } from '@svc/AuthService';
import { SellerProfileService } from '@svc/SellerProfileService';
import { PricingService } from '@svc/PricingService';
import type { CalculationService } from '@svc/CalculationService';
import type { FeeProfileService } from '@svc/FeeProfileService';
import type { AppConfig } from './config/env';
import { type TokenUtil, makeTokenUtil } from './auth/token';

export interface ApiServices {
  readonly calculation: CalculationService;
  readonly feeProfile: FeeProfileService;
  readonly auth: AuthService;
  readonly sellers: SellerProfileService;
  readonly pricing: PricingService;
}

export interface Container {
  readonly services: ApiServices;
  readonly token: TokenUtil;
  readonly pool: Pool;
  close(): Promise<void>;
}

/**
 * Composition root. The only place that constructs repositories and wires them
 * into services. Routes receive services + token, never repositories.
 */
export function buildContainer(config: AppConfig): Container {
  const pool = createPool(config.databaseUrl);
  const base = makeServices(pool);
  const auth = new AuthService({ users: new UserRepository(pool) });
  const sellers = new SellerProfileService({ sellers: new SellerProfileRepository(pool) });
  const pricing = new PricingService({
    sellerProfiles: new SellerProfileRepository(pool),
    feeProfiles: new FeeProfileRepository(pool),
    feeRules: new FeeRuleRepository(pool),
  });
  const token = makeTokenUtil(config.authSecret, config.authTokenTtlSeconds);

  return {
    services: {
      calculation: base.calculation,
      feeProfile: base.feeProfile,
      auth,
      sellers,
      pricing,
    },
    token,
    pool,
    close: () => pool.end(),
  };
}
