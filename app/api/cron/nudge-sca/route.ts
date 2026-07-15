// FILE: app/api/cron/nudge-sca/route.ts
// -----------------------------------------------------------------------------
// POST|GET /api/cron/nudge-sca
// Re-sends the "complete your payment" link to orders stuck in requires_action
// (SCA), on a fixed interval, up to SCA_NUDGE_MAX nudges. Protected by
// CRON_SECRET.
//
// Kept as an individually callable route for manual testing/recovery even
// though production scheduling goes through the single dispatcher
// (app/api/cron/dispatch) on the Vercel Hobby plan — see that route's comment.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { runNudgeSca } from "@/lib/cron/jobs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ errors: ["Unauthorized."] }, { status: 401 });
  }
  return NextResponse.json(await runNudgeSca());
}

export const GET = POST;
