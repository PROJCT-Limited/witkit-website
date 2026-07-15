// pricing.ts
// -----------------------------------------------------------------------------
// Server-side pricing + validation for wit kit configurable objects.
//
// GOLDEN RULE: this file is the source of truth for price. NEVER trust a price
// sent from the browser — the configurator may *display* a price, but the number
// you charge is always recomputed here, on the server, from the config params.
//
// Coefficients (base, per-cm, per-cm²) and bounds live in the product's
// `param_schema` (in Postgres), so you can tune pricing without a code deploy,
// and add product #2 by inserting a row rather than editing this file.
// -----------------------------------------------------------------------------

export interface ParamRule {
  min: number;
  max: number;
  step: number;
  priced?: boolean;    // documentation hint: does this dim feed the price? (default false)
  required?: boolean;  // must it be present? (default true)
}

export interface PricingRules {
  base_cents: 10000;              // e.g. 10000  -> $100.00
  height_cents_per_cm: 100;     // e.g.   100  -> $1.00 per cm of height
  surface_cents_per_cm2: 10;   // e.g.    10  -> $0.10 per cm² of top
}

export interface StructuralRules {
  // Optional guard: reject configs that would need a second fastener / extra support.
  maxSurfaceCm2?: number;
}

export interface ParamSchema {
  currency: string;
  pricing: PricingRules;
  params: Record<string, ParamRule>;
  structural?: StructuralRules;
}

export type Params = Record<string, number>;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface PriceBreakdown {
  base_cents: number;
  height_cents: number;
  surface_cents: number;
}

export interface PriceResult {
  price_cents: number;
  currency: string;
  breakdown: PriceBreakdown;
}

// Float-safe "is `value` a whole number of `step`s above `min`?"
// (Handles fractional steps like topThickness in 0.5 increments.)
function isOnStep(value: number, min: number, step: number): boolean {
  if (step <= 0) return true;
  const steps = (value - min) / step;
  return Math.abs(steps - Math.round(steps)) < 1e-6;
}

// -----------------------------------------------------------------------------
// Validation — enforces the physical/structural rules before anything is priced.
// -----------------------------------------------------------------------------
export function validateConfig(schema: ParamSchema, params: Params): ValidationResult {
  const errors: string[] = [];

  // 1. Each parameter defined in the schema: present, numeric, in range, on step.
  for (const [name, rule] of Object.entries(schema.params)) {
    const required = rule.required !== false;
    const value = params[name];

    if (value === undefined || value === null) {
      if (required) errors.push(`Missing required parameter: ${name}`);
      continue;
    }
    if (typeof value !== "number" || Number.isNaN(value)) {
      errors.push(`${name} must be a number`);
      continue;
    }
    if (value < rule.min || value > rule.max) {
      errors.push(`${name} must be between ${rule.min} and ${rule.max} (got ${value})`);
      continue;
    }
    if (!isOnStep(value, rule.min, rule.step)) {
      errors.push(`${name} must be in steps of ${rule.step} from ${rule.min}`);
    }
  }

  // 2. Reject unknown parameters — don't let the client smuggle in extras.
  for (const name of Object.keys(params)) {
    if (!(name in schema.params)) {
      errors.push(`Unknown parameter: ${name}`);
    }
  }

  // 3. Structural guard: "can't be too big without another fastener."
  //    Simple, single combined rule on the top's surface area. Tune / remove freely.
  const { width, depth } = params;
  if (
    schema.structural?.maxSurfaceCm2 !== undefined &&
    typeof width === "number" &&
    typeof depth === "number"
  ) {
    const surface = width * depth;
    if (surface > schema.structural.maxSurfaceCm2) {
      errors.push(
        `Top is too large (${surface} cm²). Max ${schema.structural.maxSurfaceCm2} cm² ` +
        `to stay within a single-fastener structure.`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

// -----------------------------------------------------------------------------
// Pricing — formula: price = base + height + surface
//   height  = height(cm)          × height_cents_per_cm
//   surface = width(cm) × depth(cm) × surface_cents_per_cm2
// Everything in integer cents; final total rounded defensively.
// Does NOT validate — call validateConfig first, or use priceConfiguration().
// -----------------------------------------------------------------------------
export function computePrice(schema: ParamSchema, params: Params): PriceResult {
  const { base_cents, height_cents_per_cm, surface_cents_per_cm2 } = schema.pricing;

  const height = params.height ?? 0;
  const width = params.width ?? 0;
  const depth = params.depth ?? 0;

  const height_cents = Math.round(height * height_cents_per_cm);
  const surface_cents = Math.round(width * depth * surface_cents_per_cm2);
  const price_cents = base_cents + height_cents + surface_cents;

  return {
    price_cents,
    currency: schema.currency,
    breakdown: { base_cents, height_cents, surface_cents },
  };
}

// -----------------------------------------------------------------------------
// Convenience: validate, then price. Throws if invalid so a bad config can never
// be silently priced. In your API route, prefer calling validateConfig first to
// return friendly field-level errors to the user.
// -----------------------------------------------------------------------------
export function priceConfiguration(schema: ParamSchema, params: Params): PriceResult {
  const { valid, errors } = validateConfig(schema, params);
  if (!valid) {
    throw new Error(`Invalid configuration: ${errors.join("; ")}`);
  }
  return computePrice(schema, params);
}
