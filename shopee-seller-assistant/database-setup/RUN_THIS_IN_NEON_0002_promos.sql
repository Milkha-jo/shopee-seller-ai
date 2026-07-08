-- Phase 2 add-on: Promo / Campaign Library
-- Run this ONCE in Neon's SQL editor (browser). Safe to re-run (IF NOT EXISTS).
create table if not exists promos (
  id                  uuid primary key default gen_random_uuid(),
  seller_profile_id   uuid not null references seller_profiles(id) on delete cascade,
  name                text not null,
  seller_cost         bigint not null default 0,        -- rupiah cost to you per sale
  buyer_discount_type text not null default 'NONE'
                        check (buyer_discount_type in ('NONE','PERCENTAGE','FLAT')),
  buyer_discount_value text,                             -- rate string (e.g. '0.2') or money string
  start_date          date,
  end_date            date,
  notes               text,
  created_at          timestamptz not null default now()
);
create index if not exists promos_seller_idx on promos (seller_profile_id, created_at desc);
