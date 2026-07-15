// FILE: app/api/cron/nudge-sca/route.ts
// -----------------------------------------------------------------------------
// POST|GET /api/cron/nudge-sca
// Re-sends the "complete your payment" link to orders stuck in requires_action
// (SCA), on a fixed interval, up to SCA_NUDGE_MAX nudges. Each nudge is a
// distinct email_events type (balance_action_reminder_1, _2, ...) since
// sendEmailOnce dedups per-type — a repeatable nudge needs a new type each
// time, not a weakened dedup rule. After the max, the order is left parked in
// `requires_action` for admin to see; nothing here auto-cancels.
// Protected by CRON_SECRET.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendBalanceActionReminder } from "@/lib/email/send";

export const runtime = "nodejs";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("secret") === secret;
}

const NUDGE_TYPE_RE = /^balance_action_reminder_(\d+)$/;

interface NudgeResult {
  preorderId: string;
  sent: boolean;
  nudgeNumber?: number;
  reason?: string;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ errors: ["Unauthorized."] }, { status: 401 });
  }

  const afterHours = Number(process.env.SCA_NUDGE_AFTER_HOURS ?? "48");
  const maxNudges = Number(process.env.SCA_NUDGE_MAX ?? "2");
  const cutoff = new Date(Date.now() - afterHours * 60 * 60 * 1000);

  const { data: candidates, error } = await supabaseAdmin
    .from("preorders")
    .select("id")
    .eq("status", "deposit_paid")
    .eq("balance_charge_status", "requires_action");

  if (error) {
    return NextResponse.json({ errors: ["Could not load candidate preorders."] }, { status: 500 });
  }

  const results: NudgeResult[] = [];

  for (const row of candidates ?? []) {
    try {
      const { data: events, error: eventsError } = await supabaseAdmin
        .from("email_events")
        .select("type, sent_at")
        .eq("preorder_id", row.id)
        .eq("status", "sent");

      if (eventsError) {
        results.push({ preorderId: row.id, sent: false, reason: eventsError.message });
        continue;
      }

      let lastSentAt: Date | null = null;
      let nudgesSent = 0;
      for (const e of events ?? []) {
        const match = NUDGE_TYPE_RE.exec(e.type);
        if (e.type === "balance_action_required" || match) {
          const t = new Date(e.sent_at);
          if (!lastSentAt || t > lastSentAt) lastSentAt = t;
        }
        if (match) nudgesSent++;
      }

      if (nudgesSent >= maxNudges) {
        results.push({ preorderId: row.id, sent: false, reason: "max nudges reached" });
        continue;
      }
      if (lastSentAt && lastSentAt > cutoff) {
        results.push({ preorderId: row.id, sent: false, reason: "not due yet" });
        continue;
      }

      const nudgeNumber = nudgesSent + 1;
      const { sent } = await sendBalanceActionReminder(row.id, nudgeNumber);
      results.push({ preorderId: row.id, sent, nudgeNumber });
    } catch (err) {
      console.error("nudge-sca: unexpected error for", row.id, (err as Error).message);
      results.push({ preorderId: row.id, sent: false, reason: (err as Error).message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}

export const GET = POST;
