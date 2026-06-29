import type { Pool } from 'pg';
import type { Queryable } from './types';

/**
 * Runs `fn` inside a single transaction. The supplied Queryable is the
 * transaction-scoped client — pass it to repositories so their writes
 * participate in the transaction. Commits on success; rolls back and re-throws
 * if `fn` throws. This keeps transaction control (BEGIN/COMMIT/ROLLBACK) inside
 * the persistence layer so services never issue SQL.
 */
export type TxRunner = <T>(fn: (tx: Queryable) => Promise<T>) => Promise<T>;

export function makeTxRunner(pool: Pool): TxRunner {
  return async <T>(fn: (tx: Queryable) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const result = await fn(client);
      await client.query('commit');
      return result;
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
  };
}
