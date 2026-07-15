// FILE: lib/configurations.ts
// -----------------------------------------------------------------------------
// Pure core logic for creating a configuration record. No database, no framework
// — so it's fully unit-testable. The route handler (thin) parses the request,
// calls this, then does the insert. Keeping the decision logic here means the
// "recompute the price on the server" rule is tested in isolation.
// -----------------------------------------------------------------------------

import { validateConfig, computePrice } from "./pricing";
import type { ParamSchema } from "./pricing";

export interface ProductRow {
  id: string;
  slug: string;
  active: boolean;
  param_schema: ParamSchema;
}

export interface ConfigurationInput {
  params: Record<string, unknown>;
  sessionId?: string;
}

export interface ConfigurationRecord {
  product_id: string;
  params: Record<string, number>;
  price_cents: number;
  price_breakdown: unknown;
  currency: string;
  session_id: string | null;
}

export type PrepareResult =
  | { ok: true; record: ConfigurationRecord }
  | { ok: false; status: number; errors: string[] };

// Ensure the incoming params are a flat object of finite numbers before we let
// them near the pricing engine. (validateConfig then enforces ranges/steps.)
function coerceNumericParams(raw: unknown): Record<string, number> | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    out[k] = v;
  }
  return out;
}

export function prepareConfiguration(
  product: ProductRow,
  input: ConfigurationInput
): PrepareResult {
  if (!product.active) {
    return { ok: false, status: 404, errors: ["Product is not available."] };
  }

  const params = coerceNumericParams(input.params);
  if (!params) {
    return { ok: false, status: 400, errors: ["`params` must be an object of numbers."] };
  }

  const { valid, errors } = validateConfig(product.param_schema, params);
  if (!valid) {
    return { ok: false, status: 400, errors };
  }

  // The one line that matters: price is recomputed here, never taken from input.
  const { price_cents, currency, breakdown } = computePrice(product.param_schema, params);

  return {
    ok: true,
    record: {
      product_id: product.id,
      params,
      price_cents,
      price_breakdown: breakdown,
      currency,
      session_id: input.sessionId ?? null,
    },
  };
}
