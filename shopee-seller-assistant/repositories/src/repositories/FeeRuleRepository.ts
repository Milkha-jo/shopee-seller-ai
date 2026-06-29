import { type Result, err, ok } from '@core/errors';
import type { FeeType, Money, Rate } from '@core/types';
import type { FeeRule } from '../domain';
import type { FeeRuleRow, Queryable } from '../db/types';
import { mapDbError } from '../db/mapError';
import { toFeeRule } from '../db/rowMappers';

export class FeeRuleRepository {
  constructor(private readonly db: Queryable) {}

  async create(input: {
    feeProfileId: string;
    feeType: FeeType;
    rate: Rate;
    cap: Money | null;
  }): Promise<Result<FeeRule>> {
    try {
      const r = await this.db.query(
        `insert into fee_rules (fee_profile_id, fee_type, rate, cap)
         values ($1, $2, $3, $4) returning *`,
        [
          input.feeProfileId,
          input.feeType,
          input.rate.toString(),
          input.cap === null ? null : input.cap.toNumber(),
        ],
      );
      return ok(toFeeRule(r.rows[0] as unknown as FeeRuleRow));
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async list(feeProfileId: string): Promise<Result<FeeRule[]>> {
    try {
      const r = await this.db.query(
        'select * from fee_rules where fee_profile_id = $1 order by fee_type',
        [feeProfileId],
      );
      return ok(r.rows.map((row) => toFeeRule(row as unknown as FeeRuleRow)));
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async delete(id: string): Promise<Result<boolean>> {
    try {
      const r = await this.db.query(
        'delete from fee_rules where id = $1 returning id',
        [id],
      );
      return ok(r.rows.length > 0);
    } catch (e) {
      return err(mapDbError(e));
    }
  }
}
