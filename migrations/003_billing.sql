-- =============================================================================
-- wit kit — Step 5 migration: email reliability + balance-charge tracking.
-- Postgres / Supabase. Run in the Supabase SQL editor AFTER 002_preorders.sql.
-- =============================================================================

-- Part 1: email reliability — separate "claimed" from "succeeded" so a failed
-- send can be retried instead of permanently blocking that (preorder_id, type).
alter table email_events
  add column if not exists error text,
  add column if not exists updated_at timestamptz not null default now();
update email_events set status = 'sent' where status is null;   -- backfill
alter table email_events alter column status set default 'pending';
alter table email_events alter column status set not null;

-- Part 3: balance-charge tracking
alter table preorders
  add column if not exists stripe_balance_pi_id text,
  add column if not exists balance_charge_status text;  -- null | requires_action | failed | succeeded
