// FILE: app/api/preorders/[id]/cancel/route.ts
// -----------------------------------------------------------------------------
// POST /api/preorders/:token/cancel — customer-facing cancellation, addressed
// by the same unguessable lookup_token as /order/[token] (passwordless by
// design). Eligibility and the refund itself live in lib/billing/cancelPreorder.
//
// The dynamic segment is named [id] (not [token]) purely because Next.js
// requires every route sharing the app/api/preorders/[X]/... parent to use
// the same slug name, and the sibling app/api/preorders/[id]/route.ts (the
// preorder-summary GET, keyed by the preorder's UUID) already claims `id`.
// The value received here is still the lookup_token — destructured as such
// below — never the UUID.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cancelPreorder } from "@/lib/billing/cancelPreorder";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: token } = await params;

  const { data: preorder, error } = await supabaseAdmin
    .from("preorders")
    .select("id")
    .eq("lookup_token", token)
    .maybeSingle();

  if (error || !preorder) {
    return NextResponse.json({ errors: ["Order not found."] }, { status: 404 });
  }

  const result = await cancelPreorder(preorder.id);
  if (!result.ok) {
    return NextResponse.json({ errors: [result.message] }, { status: result.status });
  }
  return NextResponse.json({ status: "cancelled" });
}
