-- =============================================================================
-- wit kit — Step 3/4 migration: preorders, deposit checkout, payments, email log.
-- Postgres / Supabase. Money is stored as integer cents. Currency: USD.
-- Run this in the Supabase SQL editor (or as a migration) AFTER schema.sql.
-- =============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()
create extension if not exists "citext";   -- case-insensitive email uniqueness

create type preorder_status as enum
  ('pending','deposit_paid','confirmed','cancelled','refunded','in_production','fulfilled');
create type payment_type as enum ('deposit','balance','full');

-- One row per real-world person, keyed by email. Reused across preorders and
-- across the future customer-facing order lookup / account flow.
create table customers (
  id                 uuid primary key default gen_random_uuid(),
  email              citext not null unique,
  name               text,
  phone              text,
  stripe_customer_id text unique,
  auth_user_id       uuid,
  marketing_consent  boolean not null default false,
  consent_at         timestamptz,
  created_at         timestamptz not null default now()
);

-- A configuration turned into an order. Amounts are frozen at creation from the
-- configuration's server-computed price_cents — never recomputed from the client.
create table preorders (
  id                       uuid primary key default gen_random_uuid(),
  customer_id              uuid not null references customers(id),
  configuration_id         uuid not null references configurations(id),
  status                   preorder_status not null default 'pending',
  quantity                 int not null default 1 check (quantity >= 1),
  currency                 text not null default 'usd',
  total_cents              integer not null check (total_cents >= 0),
  deposit_cents            integer not null check (deposit_cents >= 0),
  balance_cents            integer not null check (balance_cents >= 0),
  shipping_snapshot        jsonb not null,
  stripe_customer_id       text,
  stripe_deposit_pi_id     text unique,
  stripe_payment_method_id text,
  lookup_token             text not null unique,
  cancellation_deadline    timestamptz not null,
  terms_agreed_at          timestamptz not null default now(),
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index preorders_customer_id_idx on preorders (customer_id);
create index preorders_status_idx on preorders (status);

-- One row per Stripe PaymentIntent that actually settled against a preorder.
-- The unique constraint on stripe_payment_intent_id is what makes the webhook
-- handler idempotent against Stripe's at-least-once delivery / manual replays.
create table payments (
  id                       uuid primary key default gen_random_uuid(),
  preorder_id              uuid not null references preorders(id),
  stripe_payment_intent_id text not null unique,
  type                     payment_type not null,
  amount_cents             integer not null,
  status                   text not null,
  created_at               timestamptz not null default now()
);

-- Log of transactional emails actually sent. The unique (preorder_id, type)
-- constraint is the idempotency guard: a webhook retry can't double-send.
create table email_events (
  id          uuid primary key default gen_random_uuid(),
  preorder_id uuid references preorders(id),
  type        text not null,
  provider_id text,
  status      text,
  sent_at     timestamptz not null default now(),
  unique (preorder_id, type)
);

alter table customers    enable row level security;
alter table preorders    enable row level security;
alter table payments     enable row level security;
alter table email_events enable row level security;
-- No public RLS policies: these hold PII and are only touched by the service-role
-- key on the server. (A narrow customer-facing status policy comes in a later step.)
