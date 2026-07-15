// FILE: app/api/admin/preorders/[id]/cancel/route.ts
// -----------------------------------------------------------------------------
// POST /api/admin/preorders/:id/cancel — admin-triggered cancel+refund, same
// eligibility rules as the customer route (lib/billing/cancelPreorder). Lets
// Valeria action a cancellation request received by email/phone.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { cancelPreorder } from "@/lib/billing/cancelPreorder";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await cancelPreorder(id);
  if (!result.ok) {
    return NextResponse.json({ errors: [result.message] }, { status: result.status });
  }
  return NextResponse.json({ status: "cancelled" });
}
