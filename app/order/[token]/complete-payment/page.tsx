// FILE: app/order/[token]/complete-payment/page.tsx
// -----------------------------------------------------------------------------
// SCA fallback: the link sent in the balance_action_required email. Retrieves
// the balance PaymentIntent's client_secret server-side and hands it to the
// Payment Element for the customer to authenticate on-session. Passwordless
// via the same lookup_token as /order/[token].
// -----------------------------------------------------------------------------

import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { CompletePaymentClient } from "./CompletePaymentClient";

export default async function CompletePaymentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const { data: preorder } = await supabaseAdmin
    .from("preorders")
    .select("id, balance_charge_status, stripe_balance_pi_id")
    .eq("lookup_token", token)
    .maybeSingle();

  if (!preorder) notFound();

  if (preorder.balance_charge_status !== "requires_action" || !preorder.stripe_balance_pi_id) {
    return (
      <main style={{ maxWidth: 480, margin: "0 auto", padding: 32 }}>
        <p>There's nothing pending for this order right now.</p>
        <p>
          <a href={`/order/${token}`}>Back to order status</a>
        </p>
      </main>
    );
  }

  const pi = await stripe.paymentIntents.retrieve(preorder.stripe_balance_pi_id);

  if (!pi.client_secret) {
    return (
      <main style={{ maxWidth: 480, margin: "0 auto", padding: 32 }}>
        <p>This payment can't be completed right now. Please contact us.</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 32 }}>
      <h1>Complete your payment</h1>
      <CompletePaymentClient clientSecret={pi.client_secret} token={token} />
    </main>
  );
}
