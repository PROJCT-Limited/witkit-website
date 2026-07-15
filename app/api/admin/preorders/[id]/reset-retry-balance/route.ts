// FILE: app/api/admin/preorders/[id]/reset-retry-balance/route.ts
// -----------------------------------------------------------------------------
// POST /api/admin/preorders/:id/reset-retry-balance
// Manual override for "the customer says try my card again" — clears the
// abandoned flag and immediately re-invokes the charge.
//
// Deliberately does NOT reset balance_attempts to 0, despite that being the
// naive reading of "reset": chargeBalanceForPreorder's Stripe idempotency key
// is `balance:{id}:{attemptNumber}`, and Stripe holds idempotency keys for
// ~24h regardless of what our own DB says. Resetting the counter to 0 would
// reuse the exact key from the original (now-abandoned) attempt — and if the
// customer supplied a different card in the meantime, Stripe rejects the
// request outright as a parameter mismatch on that key, rather than making a
// new charge attempt. Leaving balance_attempts to keep climbing guarantees a
// key that's never been used, so the retry always actually retries.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { chargeBalanceForPreorder } from "@/lib/billing/chargeBalanceForPreorder";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { error } = await supabaseAdmin
    .from("preorders")
    .update({
      balance_abandoned_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ errors: ["Could not reset retry state."] }, { status: 500 });
  }

  const outcome = await chargeBalanceForPreorder(id);
  return NextResponse.json(outcome);
}
