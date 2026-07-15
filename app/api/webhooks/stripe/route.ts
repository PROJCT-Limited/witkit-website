// FILE: app/api/webhooks/stripe/route.ts
// -----------------------------------------------------------------------------
// POST /api/webhooks/stripe
// The SOURCE OF TRUTH for payment. Neither the browser redirect after
// confirmPayment() nor chargeBalanceForPreorder's synchronous Stripe response
// ever marks a preorder `deposit_paid`/`confirmed` — only this handler does,
// after Stripe confirms it. (chargeBalanceForPreorder does set
// balance_charge_status eagerly for cron/admin bookkeeping, but `status`
// itself is exclusively this handler's job.)
//
// Must run on Node (raw body + crypto for signature verification, not Edge).
// Idempotency relies on two DB unique constraints, not in-memory state:
//   - payments.stripe_payment_intent_id  -> replayed events don't double-record
//   - email_events (preorder_id, type)   -> replayed events don't double-email
// -----------------------------------------------------------------------------

import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  sendDepositReceiptForPreorder,
  sendBalancePaid,
  sendBalanceFailed,
  sendRefundConfirmation,
} from "@/lib/email/send";

export const runtime = "nodejs";

async function handleDepositSucceeded(pi: Stripe.PaymentIntent): Promise<void> {
  const preorderId = pi.metadata?.preorder_id;
  if (!preorderId) return;

  const { error: paymentInsertError } = await supabaseAdmin.from("payments").insert({
    preorder_id: preorderId,
    stripe_payment_intent_id: pi.id,
    type: "deposit",
    amount_cents: pi.amount_received,
    status: pi.status,
  });

  if (paymentInsertError) {
    // Unique violation on stripe_payment_intent_id (code 23505) => this event
    // was already processed by an earlier delivery. Any other insert error
    // means we can't safely proceed either way, so stop and let it be logged.
    console.log("payment_intent.succeeded (deposit) skipped (already processed or insert failed):", pi.id, paymentInsertError.message);
    return;
  }

  const paymentMethodId =
    typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id ?? null;
  const stripeCustomerId = typeof pi.customer === "string" ? pi.customer : pi.customer?.id ?? null;

  const { error: updateError } = await supabaseAdmin
    .from("preorders")
    .update({
      status: "deposit_paid",
      stripe_payment_method_id: paymentMethodId,
      stripe_customer_id: stripeCustomerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", preorderId);

  if (updateError) {
    console.error("preorder status update failed:", updateError.message);
  }

  await sendDepositReceiptForPreorder(preorderId);
}

async function handleBalanceSucceeded(pi: Stripe.PaymentIntent): Promise<void> {
  const preorderId = pi.metadata?.preorder_id;
  if (!preorderId) return;

  const { error: paymentInsertError } = await supabaseAdmin.from("payments").insert({
    preorder_id: preorderId,
    stripe_payment_intent_id: pi.id,
    type: "balance",
    amount_cents: pi.amount_received,
    status: pi.status,
  });

  if (paymentInsertError) {
    console.log("payment_intent.succeeded (balance) skipped (already processed or insert failed):", pi.id, paymentInsertError.message);
    return;
  }

  const { error: updateError } = await supabaseAdmin
    .from("preorders")
    .update({
      status: "confirmed",
      balance_charge_status: "succeeded",
      updated_at: new Date().toISOString(),
    })
    .eq("id", preorderId);

  if (updateError) {
    console.error("preorder confirmed update failed:", updateError.message);
  }

  await sendBalancePaid(preorderId);
}

async function handleBalanceFailed(pi: Stripe.PaymentIntent): Promise<void> {
  const preorderId = pi.metadata?.preorder_id;
  if (!preorderId) return;

  // An off-session confirm that needs SCA fails BOTH synchronously (caught
  // inline by chargeBalanceForPreorder, which already sets `requires_action`
  // and sends balance_action_required) AND asynchronously via this same
  // payment_intent.payment_failed event. Don't let the async echo of that
  // exact case downgrade `requires_action` to `failed` or send a contradictory
  // balance_failed email — only genuine declines (insufficient funds, etc.)
  // should land here as a real failure.
  if (pi.last_payment_error?.code === "authentication_required") {
    return;
  }

  // chargeBalanceForPreorder already handles the common case (a synchronous
  // decline on the create+confirm call) inline. This is the async safety net
  // for a failure that surfaces only via webhook — guard the same way so a
  // duplicate delivery of either path doesn't double-write.
  const { error: paymentInsertError } = await supabaseAdmin.from("payments").insert({
    preorder_id: preorderId,
    stripe_payment_intent_id: pi.id,
    type: "balance",
    amount_cents: pi.amount,
    status: "failed",
  });

  if (paymentInsertError) {
    console.log("payment_intent.payment_failed (balance) skipped (already processed or insert failed):", pi.id, paymentInsertError.message);
    return;
  }

  const { error: updateError } = await supabaseAdmin
    .from("preorders")
    .update({ balance_charge_status: "failed", updated_at: new Date().toISOString() })
    .eq("id", preorderId);

  if (updateError) {
    console.error("balance_charge_status failed update failed:", updateError.message);
  }

  await sendBalanceFailed(preorderId);
}

async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  const { data: preorder, error } = await supabaseAdmin
    .from("preorders")
    .select("id, status")
    .eq("stripe_deposit_pi_id", paymentIntentId)
    .maybeSingle();

  if (error || !preorder) {
    console.error("charge.refunded: no preorder found for PI", paymentIntentId, error?.message);
    return;
  }

  if (preorder.status !== "refunded") {
    const { error: updateError } = await supabaseAdmin
      .from("preorders")
      .update({ status: "refunded", updated_at: new Date().toISOString() })
      .eq("id", preorder.id);
    if (updateError) console.error("preorder refunded update failed:", updateError.message);
  }

  // sendEmailOnce guards the actual duplicate-send on repeated `charge.refunded` deliveries.
  await sendRefundConfirmation(preorder.id);
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("missing signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("stripe webhook signature verification failed:", (err as Error).message);
    return new Response("bad signature", { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    if (pi.metadata?.kind === "balance") {
      await handleBalanceSucceeded(pi);
    } else if (pi.metadata?.kind === "deposit") {
      await handleDepositSucceeded(pi);
    }
  } else if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object as Stripe.PaymentIntent;
    if (pi.metadata?.kind === "balance") {
      await handleBalanceFailed(pi);
    } else {
      console.error("payment_intent.payment_failed:", pi.id, pi.last_payment_error?.message);
    }
  } else if (event.type === "charge.refunded") {
    await handleChargeRefunded(event.data.object as Stripe.Charge);
  }

  return new Response("ok", { status: 200 });
}
