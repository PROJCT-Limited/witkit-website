// FILE: app/api/admin/preorders/[id]/charge-balance/route.ts
// -----------------------------------------------------------------------------
// POST /api/admin/preorders/:id/charge-balance — manual trigger for a single
// order's balance charge. Used for pre-September testing and for recovering a
// `failed`/`requires_action` order after the customer sorts out payment.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { chargeBalanceForPreorder } from "@/lib/billing/chargeBalanceForPreorder";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const outcome = await chargeBalanceForPreorder(id);
  return NextResponse.json(outcome);
}
