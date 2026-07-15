// FILE: (browser) e.g. lib/client/configurator-api.ts
// -----------------------------------------------------------------------------
// The handoff: how your p5/WebGL configurator talks to the backend. Drop these
// two functions in and call them from the configurator. No Supabase in the
// browser — everything goes through your API routes.
// -----------------------------------------------------------------------------

const PRODUCT_SLUG = "wit-kit-stool";

// (Optional but recommended) On load: fetch the schema so your sliders' bounds
// come from the same place the server validates against.
export async function loadSchema(slug = PRODUCT_SLUG) {
  const res = await fetch(`/api/products/${slug}`);
  if (!res.ok) throw new Error("Could not load product schema");
  const { param_schema } = await res.json();
  // Build your controls from param_schema.params (min/max/step),
  // and optionally compute a live display price from param_schema.pricing.
  return param_schema;
}

// On "Done": persist the configuration and get back the authoritative price.
export async function saveConfiguration(
  params: Record<string, number>,
  sessionId?: string
) {
  const res = await fetch("/api/configurations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productSlug: PRODUCT_SLUG, params, sessionId }),
  });

  const data = await res.json();

  if (!res.ok) {
    // data.errors is a string[] of friendly, field-level messages.
    throw new Error(data.errors?.join(", ") ?? "Could not save configuration");
  }

  // data = { id, price_cents, currency, price_breakdown }
  // Send the user to the review page next:
  //   window.location.href = `/review/${data.id}`;
  return data as {
    id: string;
    price_cents: number;
    currency: string;
    price_breakdown: { base_cents: number; height_cents: number; surface_cents: number };
  };
}
