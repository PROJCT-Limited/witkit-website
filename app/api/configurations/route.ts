// FILE: app/api/configurations/route.ts
// -----------------------------------------------------------------------------
// POST /api/configurations
// Called when the user clicks "Done" in the configurator.
//   1. Load the product's schema.
//   2. Validate the params + RECOMPUTE the price server-side (never trust client).
//   3. Persist the configuration (service-role insert, bypasses RLS).
//   4. Return { id, price_cents, currency, price_breakdown } → route to /review/:id
// No PII is collected here — a configuration is anonymous until checkout.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { getProductBySlug } from "@/lib/products";
import { prepareConfiguration } from "@/lib/configurations";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: ["Invalid JSON body."] }, { status: 400 });
  }

  const slug = typeof body?.productSlug === "string" ? body.productSlug : null;
  if (!slug) {
    return NextResponse.json({ errors: ["`productSlug` is required."] }, { status: 400 });
  }

  const product = await getProductBySlug(slug);
  if (!product) {
    return NextResponse.json({ errors: ["Unknown or unavailable product."] }, { status: 404 });
  }

  const result = prepareConfiguration(product, {
    params: body.params,
    sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
  });

  if (!result.ok) {
    // result.errors is a friendly string[] you can show on the review UI.
    return NextResponse.json({ errors: result.errors }, { status: result.status });
  }

  const { data, error } = await supabaseAdmin
    .from("configurations")
    .insert(result.record)
    .select("id, price_cents, currency, price_breakdown")
    .single();

  if (error) {
    console.error("configuration insert failed:", error.message);
    return NextResponse.json({ errors: ["Could not save configuration."] }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
