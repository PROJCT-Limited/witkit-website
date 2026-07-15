// FILE: app/api/cron/charge-balances/route.ts
// -----------------------------------------------------------------------------
// POST|GET /api/cron/charge-balances
// Daily job: charge the remaining balance for every preorder whose
// cancellation_deadline has passed. Protected by CRON_SECRET. Idempotent —
// chargeBalanceForPreorder is state-guarded, safe to re-run any number of times.
//
// Kept as an individually callable route for manual testing/recovery even
// though production scheduling goes through the single dispatcher
// (app/api/cron/dispatch) on the Vercel Hobby plan — see that route's comment.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { runChargeBalances } from "@/lib/cron/jobs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ errors: ["Unauthorized."] }, { status: 401 });
  }
  return NextResponse.json(await runChargeBalances());
}

export const GET = POST;
