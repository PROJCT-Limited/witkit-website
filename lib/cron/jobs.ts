// FILE: lib/cron/jobs.ts
// -----------------------------------------------------------------------------
// The actual work behind each /api/cron/* route, factored out so it can be
// called either individually (each route below, for manual testing/recovery)
// or in sequence from the single dispatcher (app/api/cron/dispatch/route.ts) —
// the Hobby-plan path, since Vercel's free tier caps cron *jobs*, not how many
// things a single job does per run.
// -----------------------------------------------------------------------------

import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendBalanceReminder, sendBalanceActionReminder } from "@/lib/email/send";
import { chargeBalanceForPreorder, type ChargeBalanceOutcome } from "@/lib/billing/chargeBalanceForPreorder";

export interface JobResult {
  processed: number;
  results: unknown[];
  error?: string;
}

export async function runSendBalanceReminders(): Promise<JobResult> {
  const daysBefore = Number(process.env.BALANCE_REMINDER_DAYS_BEFORE ?? "5");
  const windowEnd = new Date(Date.now() + daysBefore * 24 * 60 * 60 * 1000).toISOString();

  const { data: due, error } = await supabaseAdmin
    .from("preorders")
    .select("id")
    .eq("status", "deposit_paid")
    .lte("cancellation_deadline", windowEnd);

  if (error) return { processed: 0, results: [], error: "Could not load due preorders." };

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

  return { processed: results.length, results };
}

export async function runChargeBalances(): Promise<JobResult> {
  const { data: due, error } = await supabaseAdmin
    .from("preorders")
    .select("id")
    .lte("cancellation_deadline", new Date().toISOString())
    .eq("status", "deposit_paid")
    .is("balance_charge_status", null);

  if (error) return { processed: 0, results: [], error: "Could not load due preorders." };

  const results: Array<{ preorderId: string } & ChargeBalanceOutcome> = [];
  for (const row of due ?? []) {
    try {
      const outcome = await chargeBalanceForPreorder(row.id);
      results.push({ preorderId: row.id, ...outcome });
    } catch (err) {
      console.error("charge-balances: unexpected error for", row.id, (err as Error).message);
      results.push({
        preorderId: row.id,
        outcome: "failed",
        paymentIntentId: null,
        message: (err as Error).message,
        abandoned: false,
      });
    }
  }

  return { processed: results.length, results };
}

export async function runRetryBalanceCharges(): Promise<JobResult> {
  const maxAttempts = Number(process.env.BALANCE_RETRY_MAX_ATTEMPTS ?? "4");
  const intervalHours = Number(process.env.BALANCE_RETRY_INTERVAL_HOURS ?? "72");
  const cutoff = new Date(Date.now() - intervalHours * 60 * 60 * 1000).toISOString();

  const { data: due, error } = await supabaseAdmin
    .from("preorders")
    .select("id")
    .eq("status", "deposit_paid")
    .eq("balance_charge_status", "failed")
    .is("balance_abandoned_at", null)
    .lt("balance_attempts", maxAttempts)
    .lt("last_balance_attempt_at", cutoff);

  if (error) return { processed: 0, results: [], error: "Could not load due preorders." };

  const results: Array<{ preorderId: string } & ChargeBalanceOutcome> = [];
  for (const row of due ?? []) {
    try {
      const outcome = await chargeBalanceForPreorder(row.id);
      results.push({ preorderId: row.id, ...outcome });
    } catch (err) {
      console.error("retry-balance-charges: unexpected error for", row.id, (err as Error).message);
      results.push({
        preorderId: row.id,
        outcome: "failed",
        paymentIntentId: null,
        message: (err as Error).message,
        abandoned: false,
      });
    }
  }

  return { processed: results.length, results };
}

const NUDGE_TYPE_RE = /^balance_action_reminder_(\d+)$/;

interface NudgeResult {
  preorderId: string;
  sent: boolean;
  nudgeNumber?: number;
  reason?: string;
}

export async function runNudgeSca(): Promise<JobResult> {
  const afterHours = Number(process.env.SCA_NUDGE_AFTER_HOURS ?? "48");
  const maxNudges = Number(process.env.SCA_NUDGE_MAX ?? "2");
  const cutoff = new Date(Date.now() - afterHours * 60 * 60 * 1000);

  const { data: candidates, error } = await supabaseAdmin
    .from("preorders")
    .select("id")
    .eq("status", "deposit_paid")
    .eq("balance_charge_status", "requires_action");

  if (error) return { processed: 0, results: [], error: "Could not load candidate preorders." };

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

  return { processed: results.length, results };
}
