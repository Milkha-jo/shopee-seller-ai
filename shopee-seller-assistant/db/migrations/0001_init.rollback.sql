-- ============================================================================
-- Phase 2 — Step 1: Database Foundation (rollback for 0001_init)
-- Reverses 0001_init.sql. Dropped in reverse dependency order; dropping a table
-- also removes its indexes, constraints, and triggers.
-- ============================================================================

begin;

drop table if exists fee_rules;
drop table if exists fee_profiles;
drop table if exists seller_profiles;   -- also drops seller_profiles_set_updated_at
drop table if exists users;

drop function if exists set_updated_at();

drop type if exists fee_type;
drop type if exists seller_tier;

-- btree_gist is intentionally left installed: it may be shared by other objects
-- and re-creating it in the forward migration is idempotent. To fully reverse:
-- drop extension if exists btree_gist;

commit;
