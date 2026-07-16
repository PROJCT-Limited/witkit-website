// FILE: app/api/configurations/[id]/route.ts
// -----------------------------------------------------------------------------
// GET /api/configurations/:id
// Rehydrates a saved configuration — powers shareable/resumable links and the
// review page. Configs carry no PII, so this is safe to read by (unguessable) id.
// (Next.js 15: route `params` is a Promise and must be awaited.)
//
// Joins in the product's slug/name/lead_time_weeks: the review page needs the
// slug to know which 3D model to render (params alone don't reliably say —
// e.g. a square table is indistinguishable from a stool by shape).
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("configurations")
    .select(
      "id, product_id, params, price_cents, currency, price_breakdown, created_at, products(slug, name, lead_time_weeks)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("configuration fetch failed:", error.message);
    return NextResponse.json({ errors: ["Could not load configuration."] }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ errors: ["Configuration not found."] }, { status: 404 });
  }

  return NextResponse.json(data);
}
