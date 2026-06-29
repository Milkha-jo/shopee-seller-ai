import pg from 'pg';

// Return DATE as the raw 'YYYY-MM-DD' string (preserves IsoDate exactly) and
// TIMESTAMPTZ as an ISO-8601 string, instead of node-postgres' default local
// Date objects (which can shift across time zones). int8 (cap) and numeric
// (rate) already arrive as strings by default.
pg.types.setTypeParser(1082, (v: string) => v); // date
pg.types.setTypeParser(1184, (v: string) => new Date(v).toISOString()); // timestamptz
pg.types.setTypeParser(1114, (v: string) => new Date(v).toISOString()); // timestamp

export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({ connectionString });
}

export type { Pool, PoolClient } from 'pg';
