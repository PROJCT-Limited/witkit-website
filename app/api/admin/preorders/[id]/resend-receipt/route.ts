// FILE: app/api/admin/preorders/[id]/resend-receipt/route.ts
// -----------------------------------------------------------------------------
// POST /api/admin/preorders/:id/resend-receipt
// Manual recovery for a failed (or stuck) deposit_receipt email. Protected by
// proxy.ts. Reuses sendEmailOnce's retry semantics — safe to click twice.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { sendDepositReceiptForPreorder } from "@/lib/email/send";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await sendDepositReceiptForPreorder(id);
  return NextResponse.json(result);
}
