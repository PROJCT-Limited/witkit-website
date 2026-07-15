-- =============================================================================
-- wit kit — retry-gap migration: balance-charge retries + SCA nudges.
-- Postgres / Supabase. Run in the Supabase SQL editor AFTER 003_billing.sql.
-- =============================================================================

alter table preorders
  add column if not exists balance_attempts int not null default 0,
  add column if not exists last_balance_attempt_at timestamptz,
  add column if not exists balance_abandoned_at timestamptz;  -- gave up; needs a human
