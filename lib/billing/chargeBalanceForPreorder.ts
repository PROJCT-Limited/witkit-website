// FILE: lib/billing/chargeBalanceForPreorder.ts
// -----------------------------------------------------------------------------
// Runs the off-session balance charge for a single preorder. Called by the
// daily due-balance cron, the retry cron, and the admin "Charge balance now" /
// "Reset & retry" actions — all wrap each call so one order's failure never
// aborts a batch.
//
// Every call that reaches the actual Stripe API attempt (i.e. survives the
// early skip-guards below) counts as one attempt: balance_attempts is bumped
// and last_balance_attempt_at is stamped regardless of outcome (succeeded,
// requires_action, or failed). The Stripe idempotency key is scoped to that
// specific attempt number (`balance:{id}:{n}`) rather than just the preorder —
// a genuine retry is a new charge attempt, not a replay of the same one, but
// each individual attempt still needs to be safely re-runnable if the request
// itself is retried (e.g. a network blip mid-call).
//
// Payment truth still comes from the webhook: on a synchronous Stripe success
// we also set balance_charge_status='succeeded' here (so a second cron run in
// the same window doesn't re-attempt), but `status` only ever flips to
// `confirmed` in the webhook handler, same rule as the deposit charge.
//
// Declines (not SCA) count toward BALANCE_RETRY_MAX_ATTEMPTS: once an attempt
// pushes balance_attempts to the max and still fails, the order is marked
// balance_abandoned_at and a one-time balance_final_notice email goes out.
// Nothing here auto-cancels or auto-refunds — a human decides from admin.
// SCA (requires_action) is NOT subject to this abandon logic; that path is
// re-nudged on its own schedule by app/api/cron/nudge-sca instead.
// -----------------------------------------------------------------------------

import Stripe from "stripe";
import { stripe } from "@/lib/stripe/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  sendBalanceActionRequired,
  sendBalanceFailed,
  sendBalanceFinalNotice,
} from "@/lib/email/send";

export type ChargeBalanceOutcome =
  | { outcome: "skipped"; reason: string }
  | { outcome: "succeeded"; paymentIntentId: string }
  | { outcome: "requires_action"; paymentIntentId: string | null }
  | { outcome: "failed"; paymentIntentId: string | null; message: string; abandoned: boolean };

interface PreorderForCharge {
  id: string;
  status: string;
  balance_charge_status: string | null;
  balance_cents: number;
  currency: string;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  balance_attempts: number;
}

export async function chargeBalanceForPreorder(preorderId: string): Promise<ChargeBalanceOutcome> {
  const { data: preorder, error } = await supabaseAdmin
    .from("preorders")
    .select(
      "id, status, balance_charge_status, balance_cents, currency, stripe_customer_id, stripe_payment_method_id, balance_attempts"
    )
    .eq("id", preorderId)
    .maybeSingle<PreorderForCharge>();

  if (error || !preorder) {
    return { outcome: "skipped", reason: "preorder not found" };
  }
  if (preorder.status !== "deposit_paid") {
    return { outcome: "skipped", reason: `status is "${preorder.status}", not "deposit_paid"` };
  }
  if (preorder.balance_charge_status === "succeeded") {
    return { outcome: "skipped", reason: "balance already charged" };
  }
  if (!preorder.stripe_customer_id || !preorder.stripe_payment_method_id) {
    return { outcome: "skipped", reason: "missing saved Stripe customer/payment method" };
  }

  // Re-bind so the nested closures below retain the non-null narrowing.
  const order = preorder;
  const nowIso = () => new Date().toISOString();
  const attemptNumber = order.balance_attempts + 1;
  const maxAttempts = Number(process.env.BALANCE_RETRY_MAX_ATTEMPTS ?? "4");

  async function recordAttempt(extra: Record<string, unknown> = {}) {
    await supabaseAdmin
      .from("preorders")
      .update({
        balance_attempts: attemptNumber,
        last_balance_attempt_at: nowIso(),
        updated_at: nowIso(),
        ...extra,
      })
      .eq("id", order.id);
  }

  try {
    const pi = await stripe.paymentIntents.create(
      {
        amount: order.balance_cents,
        currency: order.currency,
        customer: order.stripe_customer_id!,
        payment_method: order.stripe_payment_method_id!,
        off_session: true,
        confirm: true,
        metadata: { preorder_id: order.id, kind: "balance" },
      },
      { idempotencyKey: `balance:${order.id}:${attemptNumber}` }
    );

    if (pi.status === "succeeded") {
      await recordAttempt({ stripe_balance_pi_id: pi.id, balance_charge_status: "succeeded" });
      return { outcome: "succeeded", paymentIntentId: pi.id };
    }

    // confirm:true + off_session normally either succeeds or throws; a
    // non-succeeded, non-throwing result still needs the SCA fallback.
    await recordAttempt({ stripe_balance_pi_id: pi.id, balance_charge_status: "requires_action" });
    await sendBalanceActionRequired(order.id);
    return { outcome: "requires_action", paymentIntentId: pi.id };
  } catch (err) {
    if (!(err instanceof Stripe.errors.StripeError)) throw err;

    // Only a genuine card-level failure (StripeCardError) reflects on the
    // customer's card. Anything else — an idempotency-key conflict, a rate
    // limit, a malformed request — is a system/operational error, not a
    // decline: don't count it as an attempt, don't touch balance_attempts or
    // balance_charge_status, don't tell the customer their card was declined.
    if (!(err instanceof Stripe.errors.StripeCardError)) {
      console.error("chargeBalanceForPreorder: non-card Stripe error for", order.id, err.type, err.message);
      return { outcome: "failed", paymentIntentId: null, message: err.message, abandoned: false };
    }

    const pi = err.payment_intent as Stripe.PaymentIntent | undefined;

    if (err.code === "authentication_required" || pi?.status === "requires_action") {
      await recordAttempt({
        ...(pi?.id ? { stripe_balance_pi_id: pi.id } : {}),
        balance_charge_status: "requires_action",
      });
      await sendBalanceActionRequired(order.id);
      return { outcome: "requires_action", paymentIntentId: pi?.id ?? null };
    }

    // Card declined / insufficient funds / etc. — leave `deposit_paid` for
    // manual follow-up in admin, per spec; automatic retries happen via the
    // retry cron, not here.
    const abandoned = attemptNumber >= maxAttempts;
    await recordAttempt({
      ...(pi?.id ? { stripe_balance_pi_id: pi.id } : {}),
      balance_charge_status: "failed",
      ...(abandoned ? { balance_abandoned_at: nowIso() } : {}),
    });

    if (pi?.id) {
      await supabaseAdmin.from("payments").insert({
        preorder_id: order.id,
        stripe_payment_intent_id: pi.id,
        type: "balance",
        amount_cents: order.balance_cents,
        status: "failed",
      });
    }

    // sendEmailOnce dedups by (preorder_id, type): balance_failed only ever
    // actually sends once, on the first decline — later retries hitting this
    // same branch just no-op here, which is correct: we don't want to spam a
    // per-attempt email, only the eventual final notice matters as an escalation.
    await sendBalanceFailed(order.id);
    if (abandoned) {
      await sendBalanceFinalNotice(order.id);
    }

    return { outcome: "failed", paymentIntentId: pi?.id ?? null, message: err.message, abandoned };
  }
}
