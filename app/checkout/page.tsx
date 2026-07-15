// FILE: app/checkout/page.tsx
// -----------------------------------------------------------------------------
// GET /checkout?configurationId=... — step 1 of guest checkout: collect
// customer + shipping details and consent. Loads the configuration server-side
// only to preview the total/deposit/balance; the trusted amounts are always
// recomputed again in POST /api/preorders.
// -----------------------------------------------------------------------------

import { supabaseAdmin } from "@/lib/supabase/admin";
import { DetailsForm } from "./DetailsForm";

function formatUSD(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ configurationId?: string }>;
}) {
  const { configurationId } = await searchParams;

  if (!configurationId) {
    return (
      <main style={{ maxWidth: 480, margin: "0 auto", padding: 32 }}>
        <p>Missing configuration. Go back and finish designing your piece first.</p>
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
      <main style={{ maxWidth: 480, margin: "0 auto", padding: 32 }}>
        <p>We couldn't find that configuration. Go back and finish designing your piece first.</p>
      </main>
    );
  }

  const product = Array.isArray(configuration.products)
    ? configuration.products[0]
    : configuration.products;

  const totalCents = configuration.price_cents as number;
  const depositCents = Math.round(totalCents * 0.2);
  const balanceCents = totalCents - depositCents;

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 32 }}>
      <h1>Checkout</h1>
      <p>
        {product?.name ?? "Your piece"} — {formatUSD(totalCents)} total, made to order.
      </p>
      <p>
        Pay <strong>{formatUSD(depositCents)}</strong> now as a deposit. The remaining{" "}
        <strong>{formatUSD(balanceCents)}</strong> is charged automatically when production
        starts — see the exact terms in the form below.
      </p>
      <DetailsForm configurationId={configuration.id} />
    </main>
  );
}
