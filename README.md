# wit kit — Step 1: pricing engine + data model

Three files, no design dependency, ready to drop in and test.

- `schema.sql` — `products` + `configurations` tables, RLS, and the seeded stool.
- `pricing.ts` — server-side validation + pricing (the source of truth for price).
- `pricing.test.ts` — 11 passing tests, including the canonical $305.00 stool.

## Run the tests
```bash
npm install
npx vitest run
```

## The golden rule
The configurator may *display* a price, but the number you ever charge is
recomputed in `pricing.ts`, on the server, from the config params. The client
price is decoration; this file is truth.

## Where to tune (no code change)
Everything adjustable lives in `products.param_schema` in Postgres:
- **Prices:** `pricing.base_cents`, `height_cents_per_cm`, `surface_cents_per_cm2`.
- **Limits:** each param's `min` / `max` / `step`.
- **Structural guard:** `structural.maxSurfaceCm2` (the single-fastener ceiling).

Confirm the real dimension bounds and the fastener ceiling with the maker — the
current numbers are placeholders around your "45–50 cm safe zone."

## Wiring into POST /configurations (step 2, for reference)
```ts
import { validateConfig, computePrice } from "@/lib/pricing";

// 1. Load the product (its param_schema) from Supabase by slug.
// 2. Validate the incoming params:
const { valid, errors } = validateConfig(product.param_schema, body.params);
if (!valid) return Response.json({ errors }, { status: 400 });

// 3. Recompute the price server-side (NEVER trust body.price):
const { price_cents, currency, breakdown } = computePrice(product.param_schema, body.params);

// 4. Insert with the SERVICE-ROLE client (bypasses RLS), return the id + price:
const { data } = await supabaseAdmin.from("configurations")
  .insert({ product_id: product.id, params: body.params, price_cents, price_breakdown: breakdown, currency, session_id: body.session_id })
  .select("id, price_cents, currency, price_breakdown").single();

return Response.json(data);
```
