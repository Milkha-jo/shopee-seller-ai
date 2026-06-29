import { type Result, err, ok } from '@core/errors';
import type { SellerTier } from '@core/types';
import type { SellerProfile } from '../domain';
import type { Queryable, SellerProfileRow } from '../db/types';
import { mapDbError } from '../db/mapError';
import { toSellerProfile } from '../db/rowMappers';

export class SellerProfileRepository {
  constructor(private readonly db: Queryable) {}

  async create(input: {
    userId: string;
    storeName: string;
    marketplace: string;
    sellerTier: SellerTier;
  }): Promise<Result<SellerProfile>> {
    try {
      const r = await this.db.query(
        `insert into seller_profiles (user_id, store_name, marketplace, seller_tier)
         values ($1, $2, $3, $4) returning *`,
        [input.userId, input.storeName, input.marketplace, input.sellerTier],
      );
      return ok(toSellerProfile(r.rows[0] as unknown as SellerProfileRow));
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async getById(id: string): Promise<Result<SellerProfile | null>> {
    try {
      const r = await this.db.query(
        'select * from seller_profiles where id = $1',
        [id],
      );
      const row = r.rows[0];
      return ok(row ? toSellerProfile(row as unknown as SellerProfileRow) : null);
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async list(userId: string): Promise<Result<SellerProfile[]>> {
    try {
      const r = await this.db.query(
        'select * from seller_profiles where user_id = $1 order by created_at',
        [userId],
      );
      return ok(
        r.rows.map((row) => toSellerProfile(row as unknown as SellerProfileRow)),
      );
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async update(
    id: string,
    patch: {
      storeName?: string;
      marketplace?: string;
      sellerTier?: SellerTier;
    },
  ): Promise<Result<SellerProfile | null>> {
    try {
      const r = await this.db.query(
        `update seller_profiles set
           store_name  = coalesce($2, store_name),
           marketplace = coalesce($3, marketplace),
           seller_tier = coalesce($4, seller_tier)
         where id = $1
         returning *`,
        [
          id,
          patch.storeName ?? null,
          patch.marketplace ?? null,
          patch.sellerTier ?? null,
        ],
      );
      const row = r.rows[0];
      return ok(row ? toSellerProfile(row as unknown as SellerProfileRow) : null);
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async delete(id: string): Promise<Result<boolean>> {
    try {
      const r = await this.db.query(
        'delete from seller_profiles where id = $1 returning id',
        [id],
      );
      return ok(r.rows.length > 0);
    } catch (e) {
      return err(mapDbError(e));
    }
  }
}
