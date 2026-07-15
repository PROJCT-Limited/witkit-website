-- =============================================================================
-- wit kit — ops-error visibility migration. Postgres / Supabase.
-- Run in the Supabase SQL editor AFTER 004_retries.sql.
--
-- Surfaces non-card Stripe errors from chargeBalanceForPreorder (rate limits,
-- idempotency conflicts, malformed requests) that intentionally do NOT touch
-- balance_attempts/balance_charge_status/customer emails — those are
-- self-healing by design (the daily cron keeps re-selecting the order), but a
-- PERSISTENT non-card error would otherwise retry silently forever with no
-- signal to admin. These columns make that visible without changing retry
-- behavior.
-- =============================================================================

alter table preorders
  add column if not exists last_error text,
  add column if not exists last_error_at timestamptz,
  add column if not exists non_card_error_count int not null default 0;
