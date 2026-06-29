-- ============================================================================
-- Phase 2 — Step 1: Database Foundation (forward migration 0001_init)
-- Target:  Supabase / PostgreSQL 13+
-- Scope:   persistence only — users, seller_profiles, fee_profiles, fee_rules.
--          No API, no auth logic, no business logic, no calculations.
--
-- Compatibility: enum values and value domains mirror the FROZEN Phase 1
-- calc-core types (SellerTier, FeeType, Rate ∈ [0,1], Money cap ≥ 0 | null,
-- ISO dates, sourceRef) so a thin repository can map rows → FeeRateRow directly.
-- ============================================================================

begin;

-- --- Extensions -------------------------------------------------------------
-- btree_gist lets the exclusion constraint combine uuid equality (=) with
-- daterange overlap (&&) in a single GiST index.
create extension if not exists btree_gist;
-- gen_random_uuid() is built-in on PostgreSQL 13+ (Supabase). On older servers
-- enable pgcrypto: create extension if not exists pgcrypto;

-- --- Enum types (mirror Phase 1 calc-core enums) ----------------------------
create type seller_tier as enum ('REGULAR', 'STAR', 'STAR_PLUS', 'MALL');
create type fee_type    as enum ('ADMIN', 'SERVICE', 'PAYMENT');

-- --- updated_at maintenance (persistence hygiene only) ----------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- --- users ------------------------------------------------------------------
create table users (
  id          uuid        primary key default gen_random_uuid(),
  email       text        not null,
  created_at  timestamptz not null default now(),

  constraint users_email_key        unique (email),
  -- minimal structural guard: an '@' that is not the first character
  constraint users_email_format_chk check (position('@' in email) > 1)
);

-- --- seller_profiles (a user may own multiple stores) -----------------------
create table seller_profiles (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references users(id) on delete cascade,
  store_name   text        not null,
  marketplace  text        not null,
  seller_tier  seller_tier not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint seller_profiles_store_name_chk  check (length(btrim(store_name)) > 0),
  -- Phase 1 targets Indonesia/Shopee; widen via a later migration, not by code.
  constraint seller_profiles_marketplace_chk check (marketplace in ('SHOPEE'))
);

-- FK lookup: "all stores for a user".
create index seller_profiles_user_id_idx on seller_profiles (user_id);

create trigger seller_profiles_set_updated_at
  before update on seller_profiles
  for each row execute function set_updated_at();

-- --- fee_profiles (versioned fee configuration per store) -------------------
create table fee_profiles (
  id                uuid        primary key default gen_random_uuid(),
  seller_profile_id uuid        not null references seller_profiles(id) on delete cascade,
  effective_date    date        not null,
  end_date          date,                -- null = open-ended
  source_reference  text        not null,
  created_at        timestamptz not null default now(),

  -- a window must be non-inverted
  constraint fee_profiles_window_chk
    check (end_date is null or end_date >= effective_date),

  -- G-4: no two profiles for the same store may have overlapping effective
  -- windows. Guarantees the resolver finds at most one profile as-of any date.
  -- daterange(.., '[]') is inclusive on both bounds; a null end_date is treated
  -- as unbounded above.
  constraint fee_profiles_no_overlap
    exclude using gist (
      seller_profile_id with =,
      daterange(effective_date, end_date, '[]') with &&
    )
);

-- Resolver lookup: "effective profile for store X as of date D".
create index fee_profiles_lookup_idx
  on fee_profiles (seller_profile_id, effective_date desc);

-- --- fee_rules (one row per fee type within a profile) ----------------------
create table fee_rules (
  id             uuid         primary key default gen_random_uuid(),
  fee_profile_id uuid         not null references fee_profiles(id) on delete cascade,
  fee_type       fee_type     not null,
  rate           numeric(6,5) not null,   -- fraction, e.g. 0.02000 = 2%
  cap            bigint,                  -- whole rupiah; null = no cap
  created_at     timestamptz  not null default now(),

  -- Phase 1 Rate ∈ [0,1]
  constraint fee_rules_rate_chk check (rate >= 0 and rate <= 1),
  -- Phase 1 Money cap ≥ 0 (or null)
  constraint fee_rules_cap_chk  check (cap is null or cap >= 0),
  -- at most one row per fee type per profile (no duplicate ADMIN/SERVICE/PAYMENT).
  -- Leftmost column (fee_profile_id) also serves the FK / "rules for profile" lookup.
  constraint fee_rules_one_per_type unique (fee_profile_id, fee_type)
);

-- NOTE: G-3 completeness ("a profile MUST contain ADMIN + SERVICE + PAYMENT")
-- is a multi-row cardinality rule that cannot be expressed in plain DDL without
-- a trigger. It remains enforced by the frozen Phase 1 validation layer
-- (validateFeeRows). The DB enforces type validity, per-type uniqueness, and
-- value ranges; it does not own the completeness check.

commit;
