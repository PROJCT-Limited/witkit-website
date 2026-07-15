-- =============================================================================
-- wit kit — Step 1 schema: products + configurations
-- Postgres / Supabase. Money is stored as integer cents. Currency: USD.
-- Run this in the Supabase SQL editor (or as a migration).
-- =============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- Source of truth for what can be configured and how it's priced.
-- param_schema is read by BOTH the configurator (allowed ranges) and the
-- server-side pricing engine (rates + structural guard). One place to tune.
create table products (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  name            text not null,
  param_schema    jsonb not null,
  lead_time_weeks int,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Every configuration a user creates — persisted the moment they click "Done",
-- BEFORE any personal data is collected. price_cents is ALWAYS server-computed.
create table configurations (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references products(id),
  params          jsonb not null,
  price_cents     integer not null check (price_cents >= 0),
  price_breakdown jsonb not null,
  currency        text not null default 'usd',
  session_id      text,            -- anonymous analytics link (no PII)
  created_at      timestamptz not null default now()
);

create index configurations_product_id_idx on configurations (product_id);
create index configurations_created_at_idx on configurations (created_at);

-- -----------------------------------------------------------------------------
-- Seed: the wit kit stool.
-- Rates and bounds are PLACEHOLDERS — tune them right here, no code change needed.
--   base            $100.00  ->  base_cents            = 10000
--   height          $1.00/cm ->  height_cents_per_cm   =   100
--   surface        $0.10/cm² ->  surface_cents_per_cm2 =    10
--   structural max  4000 cm²  (~63×63) — the point past which you'd need a
--                             second fastener. Confirm the real number with the maker.
--   dimension bounds: placeholders around your "45–50 cm safe zone" — also to confirm.
-- Worked example: 40×40 top, 45 tall  =>  10000 + 4500 + 16000 = 30500 = $305.00
-- -----------------------------------------------------------------------------
insert into products (slug, name, param_schema, lead_time_weeks) values (
  'wit-kit-stool',
  'wit kit stool',
  '{
    "currency": "usd",
    "pricing": {
      "base_cents": 10000,
      "height_cents_per_cm": 100,
      "surface_cents_per_cm2": 10
    },
    "params": {
      "width":        { "min": 20,  "max": 80, "step": 1,   "priced": true },
      "depth":        { "min": 20,  "max": 80, "step": 1,   "priced": true },
      "height":       { "min": 30,  "max": 75, "step": 1,   "priced": true },
      "legWidth":     { "min": 2,   "max": 8,  "step": 0.5, "priced": false },
      "topThickness": { "min": 1.5, "max": 5,  "step": 0.5, "priced": false }
    },
    "structural": { "maxSurfaceCm2": 4000 }
  }'::jsonb,
  null
);

-- -----------------------------------------------------------------------------
-- Row-Level Security (minimal, correct for step 1).
-- Writes go through your API route using the SERVICE-ROLE key, which bypasses
-- RLS — that's how the trusted (recomputed) price gets written. The policies
-- below only govern what the public ANON key can do from the browser.
-- -----------------------------------------------------------------------------
alter table products       enable row level security;
alter table configurations enable row level security;

-- The configurator needs to read the schema of active products.
create policy "public reads active products"
  on products for select
  using (active = true);

-- Configs contain no PII and are addressed by unguessable uuid, so public read
-- by id is acceptable for now (needed for shareable/resumable links). Tighten
-- later if you ever attach anything sensitive to a configuration.
create policy "public reads configurations"
  on configurations for select
  using (true);
