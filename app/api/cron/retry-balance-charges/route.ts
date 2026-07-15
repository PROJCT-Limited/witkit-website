// FILE: app/api/cron/retry-balance-charges/route.ts
// -----------------------------------------------------------------------------
// POST|GET /api/cron/retry-balance-charges
// Re-attempts a declined balance charge on a fixed interval, up to a max
// attempt count — chargeBalanceForPreorder itself sets balance_abandoned_at
// and sends the final-notice email once that cap is hit, so this route is
// just the selection + per-order dispatch. Protected by CRON_SECRET.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { chargeBalanceForPreorder, type ChargeBalanceOutcome } from "@/lib/billing/chargeBalanceForPreorder";

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

  if (error) {
    return NextResponse.json({ errors: ["Could not load due preorders."] }, { status: 500 });
  }

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

  return NextResponse.json({ processed: results.length, results });
}

export const GET = POST;
