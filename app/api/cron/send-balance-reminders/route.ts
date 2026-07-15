// FILE: app/api/cron/send-balance-reminders/route.ts
// -----------------------------------------------------------------------------
// POST /api/cron/send-balance-reminders
// Daily job: send one balance_reminder email per deposit_paid preorder whose
// cancellation_deadline is within BALANCE_REMINDER_DAYS_BEFORE days. Idempotent
// via sendEmailOnce (a `sent` balance_reminder row blocks re-sends), so this is
// safe to re-run — including every day after the window opens, since the
// second+ run for the same preorder finds the row already `sent` and no-ops.
//
// Responds to both GET and POST: Vercel's Cron scheduler calls scheduled paths
// with GET (auto-attaching `Authorization: Bearer $CRON_SECRET`), while manual
// testing per this project's runbook uses POST.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendBalanceReminder } from "@/lib/email/send";

export const runtime = "nodejs";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("secret") === secret;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ errors: ["Unauthorized."] }, { status: 401 });
  }

  const daysBefore = Number(process.env.BALANCE_REMINDER_DAYS_BEFORE ?? "5");
  const windowEnd = new Date(Date.now() + daysBefore * 24 * 60 * 60 * 1000).toISOString();

  const { data: due, error } = await supabaseAdmin
    .from("preorders")
    .select("id")
    .eq("status", "deposit_paid")
    .lte("cancellation_deadline", windowEnd);

  if (error) {
    return NextResponse.json({ errors: ["Could not load due preorders."] }, { status: 500 });
  }

  const results: Array<{ preorderId: string; sent: boolean }> = [];
  for (const row of due ?? []) {
    try {
      const { sent } = await sendBalanceReminder(row.id);
      results.push({ preorderId: row.id, sent });
    } catch (err) {
      console.error("send-balance-reminders: unexpected error for", row.id, (err as Error).message);
      results.push({ preorderId: row.id, sent: false });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}

export const GET = POST;
