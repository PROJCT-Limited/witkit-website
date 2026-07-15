// FILE: app/api/preorders/[id]/route.ts
// -----------------------------------------------------------------------------
// GET /api/preorders/:id
// A safe, non-PII summary the checkout/thank-you pages can poll right after
// payment — the webhook is what actually flips `status`, so the browser polls
// this instead of trusting its own confirmPayment() result.
// No email/name/shipping here; those stay server-side.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("preorders")
    .select(
      "status, currency, total_cents, deposit_cents, balance_cents, cancellation_deadline, lookup_token"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("preorder fetch failed:", error.message);
    return NextResponse.json({ errors: ["Could not load preorder."] }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ errors: ["Preorder not found."] }, { status: 404 });
  }

  return NextResponse.json({
    status: data.status,
    currency: data.currency,
    totalCents: data.total_cents,
    depositCents: data.deposit_cents,
    balanceCents: data.balance_cents,
    cancellationDeadline: data.cancellation_deadline,
    lookupToken: data.lookup_token,
  });
}
