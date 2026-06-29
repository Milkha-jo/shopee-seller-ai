import { type Result, err, ok } from '@core/errors';
import type { User } from '../domain';
import type { Queryable, UserRow } from '../db/types';
import { mapDbError } from '../db/mapError';
import { toUser } from '../db/rowMappers';

export class UserRepository {
  constructor(private readonly db: Queryable) {}

  async create(input: { email: string }): Promise<Result<User>> {
    try {
      const r = await this.db.query(
        'insert into users (email) values ($1) returning id, email, created_at',
        [input.email],
      );
      return ok(toUser(r.rows[0] as unknown as UserRow));
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async getById(id: string): Promise<Result<User | null>> {
    try {
      const r = await this.db.query(
        'select id, email, created_at from users where id = $1',
        [id],
      );
      const row = r.rows[0];
      return ok(row ? toUser(row as unknown as UserRow) : null);
    } catch (e) {
      return err(mapDbError(e));
    }
  }

  async delete(id: string): Promise<Result<boolean>> {
    try {
      const r = await this.db.query(
        'delete from users where id = $1 returning id',
        [id],
      );
      return ok(r.rows.length > 0);
    } catch (e) {
      return err(mapDbError(e));
    }
  }
}
