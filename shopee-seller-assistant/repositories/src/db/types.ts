// Minimal database access contract. Both `pg.Pool` and `pg.PoolClient` satisfy
// this, so a repository can run against a pool or inside an externally-managed
// transaction (a service supplies the client). Persistence only — no pooling,
// caching, or transaction orchestration lives here.

export interface QueryResultLike {
  readonly rows: ReadonlyArray<Record<string, unknown>>;
  readonly rowCount?: number | null;
}

export interface Queryable {
  query(
    text: string,
    params?: ReadonlyArray<unknown>,
  ): Promise<QueryResultLike>;
}

// Raw row shapes as returned by PostgreSQL (snake_case). Dates/timestamps are
// returned as strings via the type parsers configured in pool.ts; int8 (cap) is
// returned as a string by node-postgres; numeric (rate) as a string.

export interface UserRow {
  id: string;
  email: string;
  created_at: string;
}

export interface SellerProfileRow {
  id: string;
  user_id: string;
  store_name: string;
  marketplace: string;
  seller_tier: string;
  created_at: string;
  updated_at: string;
}

export interface FeeProfileRow {
  id: string;
  seller_profile_id: string;
  effective_date: string;
  end_date: string | null;
  source_reference: string;
  created_at: string;
}

export interface FeeRuleRow {
  id: string;
  fee_profile_id: string;
  fee_type: string;
  rate: string;
  cap: string | null;
  created_at: string;
}
