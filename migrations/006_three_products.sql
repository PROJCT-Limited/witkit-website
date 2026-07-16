-- =============================================================================
-- wit kit — migration 006: table + shelf products.
-- Run in the Supabase SQL editor AFTER 005_ops_errors.sql.
-- (Renamed from the brief's "005_three_products.sql" — 005 was already taken
-- by the ops-error-visibility migration from the prior round.)
--
-- NO CHANGES to lib/pricing.ts are needed. All three objects use the SAME
-- engine and the SAME formula (base + height + surface); they differ only by
-- their param_schema row. Verified: the shelf works with no `topThickness` at
-- all, because validation is driven entirely by the schema.
--
-- RATES: identical across all three products, so price differences come purely
-- from size — which is what the formula is for. Tune `base_cents` per product
-- later if a table should carry a premium beyond its size.
--   base            $100.00  -> base_cents            = 10000
--   height          $1.00/cm -> height_cents_per_cm   =   100
--   surface        $0.10/cm² -> surface_cents_per_cm2 =    10
--
-- BOUNDS: taken from the prototype's sliders. STRUCTURAL CEILINGS ARE
-- PLACEHOLDERS — the "45–50 cm / avoid a second fastener" rule was given for
-- the stool only. Table and shelf ceilings must be confirmed with the maker.
-- =============================================================================

-- --- TABLE ------------------------------------------------------------------
-- Prototype: W 50–160 (110), D 35–100 (60), legH 30–95 (72), t 2–8 (4), topT 1–5 (2.5)
-- Maps 1:1 to the existing params. Default 110x60x72 => $832.00
insert into products (slug, name, param_schema, lead_time_weeks) values (
  'wit-kit-table',
  'wit kit table',
  '{
    "currency": "usd",
    "pricing": { "base_cents": 10000, "height_cents_per_cm": 100, "surface_cents_per_cm2": 10 },
    "params": {
      "width":        { "min": 50, "max": 160, "step": 1,   "priced": true },
      "depth":        { "min": 35, "max": 100, "step": 1,   "priced": true },
      "height":       { "min": 30, "max": 95,  "step": 1,   "priced": true },
      "legWidth":     { "min": 2,  "max": 8,   "step": 0.5, "priced": false },
      "topThickness": { "min": 1,  "max": 5,   "step": 0.5, "priced": false }
    },
    "structural": { "maxSurfaceCm2": 16000 }
  }'::jsonb,
  null
);

-- --- SHELF ------------------------------------------------------------------
-- Prototype: W 40–120 (80), H 50–180 (120), D 20–45 (30), t 2–6 (3)
-- NOTE: no `topThickness` — the prototype uses `t` for both uprights and boards.
-- Omitting it from the schema is correct and requires no code change; the
-- engine only prices height + width*depth. Default 80x30x120 => $460.00
--
-- PRICING CAVEAT (decide with the maker): a shelf has THREE boards, so it uses
-- ~3x the board material, but `surface` counts one W*D only. If shelves should
-- cost more, express it by RAISING this product's `surface_cents_per_cm2`
-- (e.g. 30 = three boards) or its `base_cents` — never by changing pricing.ts.
insert into products (slug, name, param_schema, lead_time_weeks) values (
  'wit-kit-shelf',
  'wit kit shelf',
  '{
    "currency": "usd",
    "pricing": { "base_cents": 10000, "height_cents_per_cm": 100, "surface_cents_per_cm2": 10 },
    "params": {
      "width":    { "min": 40, "max": 120, "step": 1,   "priced": true },
      "depth":    { "min": 20, "max": 45,  "step": 1,   "priced": true },
      "height":   { "min": 50, "max": 180, "step": 1,   "priced": true },
      "legWidth": { "min": 2,  "max": 6,   "step": 0.5, "priced": false }
    },
    "structural": { "maxSurfaceCm2": 5400 }
  }'::jsonb,
  null
);

-- --- STOOL: align the existing row to the prototype ---------------------------
-- Current seed is width/depth 20–80, maxSurfaceCm2 4000 (the original placeholder).
-- Prototype stool: S 25–60, legH 30–75, t 2–6, topT 1–4.
-- SAFETY: Valeria's note was "45–50 cm to stay safe / avoid another fastener",
-- so width/depth max is set to 50 (NOT the prototype's 60) and the ceiling to
-- 2500 (50x50). CONFIRM BOTH WITH THE MAKER.
update products
set param_schema = '{
  "currency": "usd",
  "pricing": { "base_cents": 10000, "height_cents_per_cm": 100, "surface_cents_per_cm2": 10 },
  "params": {
    "width":        { "min": 25, "max": 50, "step": 1,   "priced": true },
    "depth":        { "min": 25, "max": 50, "step": 1,   "priced": true },
    "height":       { "min": 30, "max": 75, "step": 1,   "priced": true },
    "legWidth":     { "min": 2,  "max": 6,  "step": 0.5, "priced": false },
    "topThickness": { "min": 1,  "max": 4,  "step": 0.5, "priced": false }
  },
  "structural": { "maxSurfaceCm2": 2500 }
}'::jsonb
where slug = 'wit-kit-stool';

-- Verify
select slug, name, param_schema->'pricing' as pricing, active from products order by slug;
