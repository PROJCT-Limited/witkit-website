// FILE: app/checkout/page.tsx
// -----------------------------------------------------------------------------
// GET /checkout?configurationId=... — step 1 of guest checkout: collect
// customer + shipping details and consent. Loads the configuration server-side
// only to preview the total/deposit/balance; the trusted amounts are always
// recomputed again in POST /api/preorders.
// -----------------------------------------------------------------------------

import { supabaseAdmin } from "@/lib/supabase/admin";
import { DetailsForm } from "./DetailsForm";
import styles from "./checkout.module.css";

function formatUSD(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export const metadata = { title: "Checkout — wit kit" };

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ configurationId?: string }>;
}) {
  const { configurationId } = await searchParams;

  if (!configurationId) {
    return (
      <main className={styles.page}>
        <p className={styles.lead}>Missing configuration. Go back and finish designing your piece first.</p>
      </main>
    );
  }

  const { data: configuration } = await supabaseAdmin
    .from("configurations")
    .select("id, price_cents, currency, products(name)")
    .eq("id", configurationId)
    .maybeSingle();

  if (!configuration) {
    return (
      <main className={styles.page}>
        <p className={styles.lead}>
          We couldn't find that configuration. Go back and finish designing your piece first.
        </p>
      </main>
    );
  }

  const product = Array.isArray(configuration.products) ? configuration.products[0] : configuration.products;

  const totalCents = configuration.price_cents as number;
  const depositCents = Math.round(totalCents * 0.2);
  const balanceCents = totalCents - depositCents;

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>Checkout</h1>

      <div className={styles.box}>
        <ul className={styles.summaryList}>
          <li>
            <span>{product?.name ?? "Your piece"}</span>
            <span>{formatUSD(totalCents)}</span>
          </li>
          <li>
            <span>Deposit due now</span>
            <span>{formatUSD(depositCents)}</span>
          </li>
          <li>
            <span>Balance on production start</span>
            <span>{formatUSD(balanceCents)}</span>
          </li>
        </ul>
      </div>

      <DetailsForm configurationId={configuration.id} />
    </main>
  );
}
