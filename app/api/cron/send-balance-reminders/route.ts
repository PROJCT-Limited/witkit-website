// FILE: app/api/cron/send-balance-reminders/route.ts
// -----------------------------------------------------------------------------
// POST|GET /api/cron/send-balance-reminders
// Daily job: send one balance_reminder email per deposit_paid preorder whose
// cancellation_deadline is within BALANCE_REMINDER_DAYS_BEFORE days. Idempotent
// via sendEmailOnce. Protected by CRON_SECRET.
//
// Kept as an individually callable route for manual testing/recovery even
// though production scheduling goes through the single dispatcher
// (app/api/cron/dispatch) on the Vercel Hobby plan — see that route's comment.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { runSendBalanceReminders } from "@/lib/cron/jobs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ errors: ["Unauthorized."] }, { status: 401 });
  }
  return NextResponse.json(await runSendBalanceReminders());
}

export const GET = POST;
