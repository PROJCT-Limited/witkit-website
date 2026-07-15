// FILE: app/api/products/[slug]/route.ts
// -----------------------------------------------------------------------------
// GET /api/products/:slug
// Serves the product's param_schema so the configurator builds its controls
// (min/max/step) from the SAME source of truth the server validates against —
// no drift between what the UI allows and what the server accepts.
//
// NOTE: this returns the pricing rates too, so the configurator can show a live
// price locally without a round-trip on every slider move. Those rates are not
// secret (a user can infer them from a few quotes anyway) and the authoritative
// price is always recomputed server-side. If you'd rather hide the cost model,
// strip `pricing` here and add a POST /api/price endpoint instead.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { getProductBySlug } from "@/lib/products";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const product = await getProductBySlug(slug);
  if (!product) {
    return NextResponse.json({ errors: ["Unknown or unavailable product."] }, { status: 404 });
  }

  return NextResponse.json({
    slug: product.slug,
    param_schema: product.param_schema,
  });
}
