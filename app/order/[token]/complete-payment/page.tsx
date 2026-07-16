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
import styles from "@/app/order/order.module.css";

export const metadata = { title: "Complete payment — wit kit" };

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
      <main className={styles.page}>
        <p className={styles.note}>There's nothing pending for this order right now.</p>
        <p>
          <a href={`/order/${token}`}>Back to order status</a>
        </p>
      </main>
    );
  }

  const pi = await stripe.paymentIntents.retrieve(preorder.stripe_balance_pi_id);

  if (!pi.client_secret) {
    return (
      <main className={styles.page}>
        <p className={styles.note}>This payment can't be completed right now. Please contact us.</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>Complete your payment</h1>
      <CompletePaymentClient clientSecret={pi.client_secret} token={token} />
    </main>
  );
}
