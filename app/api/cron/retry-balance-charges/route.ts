// FILE: app/api/cron/retry-balance-charges/route.ts
// -----------------------------------------------------------------------------
// POST|GET /api/cron/retry-balance-charges
// Re-attempts a declined balance charge on a fixed interval, up to a max
// attempt count. Protected by CRON_SECRET.
//
// Kept as an individually callable route for manual testing/recovery even
// though production scheduling goes through the single dispatcher
// (app/api/cron/dispatch) on the Vercel Hobby plan — see that route's comment.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { runRetryBalanceCharges } from "@/lib/cron/jobs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ errors: ["Unauthorized."] }, { status: 401 });
  }
  return NextResponse.json(await runRetryBalanceCharges());
}

export const GET = POST;
