// FILE: lib/billing/cancelPreorder.ts
// -----------------------------------------------------------------------------
// Shared cancel+refund logic behind both the customer-facing cancel route
// (app/api/preorders/[token]/cancel) and the admin cancel action. Eligibility:
// deposit_paid, before cancellation_deadline, balance never charged. Sets
// status to `cancelled` immediately and sends the ack email; `refunded` +
// refund_confirmation follow later from the `charge.refunded` webhook once
// Stripe actually processes the refund.
// -----------------------------------------------------------------------------

import { stripe } from "@/lib/stripe/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendCancellationConfirmation } from "@/lib/email/send";

export type CancelPreorderResult = { ok: true } | { ok: false; status: number; message: string };

export async function cancelPreorder(preorderId: string): Promise<CancelPreorderResult> {
  const { data: preorder, error } = await supabaseAdmin
    .from("preorders")
    .select("id, status, balance_charge_status, cancellation_deadline, stripe_deposit_pi_id")
    .eq("id", preorderId)
    .maybeSingle();

  if (error || !preorder) {
    return { ok: false, status: 404, message: "Preorder not found." };
  }
  if (preorder.status !== "deposit_paid") {
    return {
      ok: false,
      status: 409,
      message: `Cannot cancel an order with status "${preorder.status}".`,
    };
  }
  if (preorder.balance_charge_status === "succeeded") {
    return { ok: false, status: 409, message: "The balance has already been charged." };
  }
  if (new Date() >= new Date(preorder.cancellation_deadline)) {
    return { ok: false, status: 409, message: "The cancellation deadline has passed." };
  }
  if (!preorder.stripe_deposit_pi_id) {
    return { ok: false, status: 500, message: "No deposit payment on file to refund." };
  }

  try {
    await stripe.refunds.create({ payment_intent: preorder.stripe_deposit_pi_id });
  } catch (err) {
    console.error("cancelPreorder: refund creation failed:", (err as Error).message);
    return { ok: false, status: 500, message: "Could not process refund." };
  }

  const { error: updateError } = await supabaseAdmin
    .from("preorders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", preorderId);

  if (updateError) {
    console.error("cancelPreorder: status update failed:", updateError.message);
  }

  await sendCancellationConfirmation(preorderId);

  return { ok: true };
}
