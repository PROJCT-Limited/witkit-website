// FILE: app/api/cron/charge-balances/route.ts
// -----------------------------------------------------------------------------
// POST /api/cron/charge-balances
// Daily job: charge the remaining balance for every preorder whose
// cancellation_deadline has passed. Protected by CRON_SECRET (header or query
// param, so both a scheduler's Authorization header and a manual curl/browser
// hit work). Idempotent — chargeBalanceForPreorder is state-guarded, safe to
// re-run any number of times.
//
// Responds to both GET and POST: Vercel's Cron scheduler calls scheduled paths
// with GET (auto-attaching `Authorization: Bearer $CRON_SECRET`), while manual
// testing per this project's runbook uses POST.
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

  const { data: due, error } = await supabaseAdmin
    .from("preorders")
    .select("id")
    .lte("cancellation_deadline", new Date().toISOString())
    .eq("status", "deposit_paid")
    .is("balance_charge_status", null);

  if (error) {
    return NextResponse.json({ errors: ["Could not load due preorders."] }, { status: 500 });
  }

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

  return NextResponse.json({ processed: results.length, results });
}

export const GET = POST;
