import type { Result } from '@core/errors';
import type { SellerTier } from '@core/types';
import type { SellerProfile } from '@repo/domain';

export interface NewSellerProfile {
  readonly userId: string;
  readonly storeName: string;
  readonly marketplace: string;
  readonly sellerTier: SellerTier;
}

/** Narrow seller-store port (the real SellerProfileRepository satisfies it). */
export interface SellerStore {
  create(input: NewSellerProfile): Promise<Result<SellerProfile>>;
  getById(id: string): Promise<Result<SellerProfile | null>>;
  list(userId: string): Promise<Result<SellerProfile[]>>;
}

export interface SellerProfileServiceDeps {
  readonly sellers: SellerStore;
}

/**
 * Coordinates seller-profile (store) persistence so the API never touches the
 * repository directly. Pure orchestration — no business logic.
 */
export class SellerProfileService {
  constructor(private readonly deps: SellerProfileServiceDeps) {}

  create(input: NewSellerProfile): Promise<Result<SellerProfile>> {
    return this.deps.sellers.create(input);
  }

  getById(id: string): Promise<Result<SellerProfile | null>> {
    return this.deps.sellers.getById(id);
  }

  list(userId: string): Promise<Result<SellerProfile[]>> {
    return this.deps.sellers.list(userId);
  }
}
