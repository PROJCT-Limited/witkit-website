// FILE: app/api/cron/dispatch/route.ts
// -----------------------------------------------------------------------------
// POST|GET /api/cron/dispatch
// Runs all four daily jobs in sequence, each wrapped in its own try/catch so
// one job's failure never blocks the others. This is the ONLY cron entry in
// vercel.json — the Vercel Hobby plan caps a project at 2 scheduled cron
// *jobs*, and this project needs four (reminders, charges, retries, SCA
// nudges). Consolidating into one dispatcher job that does four things per
// run stays under that cap without silently dropping any of them. Each job
// is also still individually callable at its own route
// (app/api/cron/{charge-balances,send-balance-reminders,retry-balance-charges,
// nudge-sca}) for manual testing or recovery — this route just orchestrates
// them for the scheduled run.
//
// Order matters only loosely: reminders before charges so a customer isn't
// charged and reminded in the same breath, then retries, then SCA nudges.
// Protected by CRON_SECRET, same as every other cron route.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import {
  runSendBalanceReminders,
  runChargeBalances,
  runRetryBalanceCharges,
  runNudgeSca,
  type JobResult,
} from "@/lib/cron/jobs";

export const runtime = "nodejs";
export const maxDuration = 60;

const JOBS: Array<{ name: string; run: () => Promise<JobResult> }> = [
  { name: "send-balance-reminders", run: runSendBalanceReminders },
  { name: "charge-balances", run: runChargeBalances },
  { name: "retry-balance-charges", run: runRetryBalanceCharges },
  { name: "nudge-sca", run: runNudgeSca },
];

export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ errors: ["Unauthorized."] }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const results: Array<{ job: string } & JobResult> = [];

  for (const { name, run } of JOBS) {
    try {
      results.push({ job: name, ...(await run()) });
    } catch (err) {
      console.error(`cron/dispatch: job "${name}" threw:`, (err as Error).message);
      results.push({ job: name, processed: 0, results: [], error: (err as Error).message });
    }
  }

  return NextResponse.json({ startedAt, finishedAt: new Date().toISOString(), results });
}

export const GET = POST;
