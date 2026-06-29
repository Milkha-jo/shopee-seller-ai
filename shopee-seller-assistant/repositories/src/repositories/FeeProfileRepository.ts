import { type Result, InvariantViolationError, err, ok } from '@core/errors';
import type { IsoDate } from '@core/types';
import type { FeeProfile } from '../domain';
import type { FeeProfileRow, Queryable } from '../db/types';
import { mapDbError } from '../db/mapError';
import { toFeeProfile } from '../db/rowMappers';

export class FeeProfileRepository {
  constructor(private readonly db: Queryable) {}

  async create(input: {
    sellerProfileId: string;
    effectiveDate: IsoDate;
    endDate: IsoDate | null;
    sourceReference: string;
  }): Promise<Result<FeeProfile>> {
    try {
      const r = await this.db.query(
        `insert into fee_profiles (seller_profile_id, effective_date, end_date, source_reference)
         values ($1, $2, $3, $4) returning *`,
        [
          input.sellerProfileId,
          input.effectiveDate,
          input.endDate,
          input.sourceReference,
        ],
      );
      return ok(toFeeProfile(r.rows[0] as unknown as FeeProfileRow));
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async getById(id: string): Promise<Result<FeeProfile | null>> {
    try {
      const r = await this.db.query(
        'select * from fee_profiles where id = $1',
        [id],
      );
      const row = r.rows[0];
      return ok(row ? toFeeProfile(row as unknown as FeeProfileRow) : null);
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async list(sellerProfileId: string): Promise<Result<FeeProfile[]>> {
    try {
      const r = await this.db.query(
        'select * from fee_profiles where seller_profile_id = $1 order by effective_date',
        [sellerProfileId],
      );
      return ok(
        r.rows.map((row) => toFeeProfile(row as unknown as FeeProfileRow)),
      );
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  // Returns the single profile whose window covers `asOfDate`, or null. The DB
  // exclusion constraint guarantees at most one match; seeing more than one is
  // an impossible invariant (this repository does NOT interpret overlaps).
  async findActiveAsOfDate(
    sellerProfileId: string,
    asOfDate: IsoDate,
  ): Promise<Result<FeeProfile | null>> {
    try {
      const r = await this.db.query(
        `select * from fee_profiles
         where seller_profile_id = $1
           and effective_date <= $2
           and (end_date is null or end_date >= $2)`,
        [sellerProfileId, asOfDate],
      );
      if (r.rows.length > 1) {
        throw new InvariantViolationError(
          `overlapping fee profiles for seller_profile ${sellerProfileId} as of ${asOfDate}: ${r.rows.length} rows`,
        );
      }
      const row = r.rows[0];
      return ok(row ? toFeeProfile(row as unknown as FeeProfileRow) : null);
    } catch (e) {
      if (e instanceof InvariantViolationError) throw e;
      return err(mapDbError(e));
    }
  }

  async delete(id: string): Promise<Result<boolean>> {
    try {
      const r = await this.db.query(
        'delete from fee_profiles where id = $1 returning id',
        [id],
      );
      return ok(r.rows.length > 0);
    } catch (e) {
      return err(mapDbError(e));
    }
  }
}
