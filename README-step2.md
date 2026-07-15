# wit kit — Step 2: configurator → backend handoff

Saves a configuration, recomputing the price on the server, and returns an id you
route the user to (`/review/:id`). Reuses `pricing.ts` from step 1 unchanged.

## Where each file goes
The files are named flat for delivery — each has its real path in a `// FILE:` header.

| Delivered file                        | Put it at                                  |
|--------------------------------------|--------------------------------------------|
| `configurations.ts`                  | `lib/configurations.ts`                    |
| `products.ts`                        | `lib/products.ts`                          |
| `supabase-admin.ts`                  | `lib/supabase/admin.ts`                    |
| `pricing.ts` (from step 1)           | `lib/pricing.ts`                           |
| `configurations.route.ts`            | `app/api/configurations/route.ts`          |
| `configuration-by-id.route.ts`       | `app/api/configurations/[id]/route.ts`     |
| `product-by-slug.route.ts`           | `app/api/products/[slug]/route.ts`         |
| `configurator-handoff.example.ts`    | e.g. `lib/client/configurator-api.ts`      |

## Setup
```bash
npm install @supabase/supabase-js
```
Env (server only — do NOT prefix the service-role key with NEXT_PUBLIC):
```
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## The flow
1. Configurator loads → `GET /api/products/wit-kit-stool` → builds sliders from `param_schema`.
2. User designs, sees a live price (computed locally from the schema's rates).
3. User clicks **Done** → `POST /api/configurations` with `{ productSlug, params, sessionId? }`.
4. Server validates, **recomputes the price**, inserts, returns `{ id, price_cents, currency, price_breakdown }`.
5. Send them to `/review/:id`, which uses `GET /api/configurations/:id` to render the spec + price.

## The rule this enforces
The browser's price is decoration. Steps 3–4 recompute it from the params against
the product's schema, so a tampered request can't change what gets stored (and,
later, charged). The `configurations.test.ts` suite proves a smuggled `price_cents`
never reaches the saved record.

## Not included yet (deliberate)
- **Rate limiting** on `POST /api/configurations` (add before launch — e.g. Upstash
  Ratelimit — so the endpoint can't be spammed).
- **Anon Supabase client** for the browser — not needed while everything goes
  through API routes. Add it only if you later read data client-side.
