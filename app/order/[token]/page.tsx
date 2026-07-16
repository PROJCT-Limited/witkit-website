// FILE: app/order/[token]/page.tsx
// -----------------------------------------------------------------------------
// Destination for the order-status link sent in the deposit receipt email
// (lib/email/DepositReceipt.tsx). Passwordless by design: the unguessable
// lookup_token IS the auth, so this never checks for a logged-in session.
// Only non-sensitive, buyer-facing fields are selected — no Stripe ids, no
// internal columns, no other customers' data.
// -----------------------------------------------------------------------------

import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CancelButton } from "./CancelButton";
import styles from "@/app/order/order.module.css";

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const paramLabels: Record<string, string> = {
  width: "Width",
  depth: "Depth",
  height: "Height",
  legWidth: "Leg width",
  topThickness: "Top thickness",
};

const statusLabels: Record<string, string> = {
  pending: "Payment pending",
  deposit_paid: "Deposit paid — order confirmed",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  in_production: "In production",
  fulfilled: "Fulfilled — shipped",
};

export const metadata = { title: "Order status — wit kit" };

export default async function OrderStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const { data: preorder, error: preorderError } = await supabaseAdmin
    .from("preorders")
    .select(
      "status, balance_charge_status, total_cents, deposit_cents, balance_cents, currency, cancellation_deadline, configuration_id"
    )
    .eq("lookup_token", token)
    .maybeSingle();

  if (preorderError) {
    console.error("order status lookup failed:", preorderError.message);
  }
  if (!preorder) notFound();

  const { data: configuration } = await supabaseAdmin
    .from("configurations")
    .select("params, products(name, lead_time_weeks)")
    .eq("id", preorder.configuration_id)
    .maybeSingle();

  const product = Array.isArray(configuration?.products)
    ? configuration.products[0]
    : configuration?.products;

  const orderRef = token.slice(0, 8).toUpperCase();
  const statusLabel = statusLabels[preorder.status] ?? preorder.status;
  const balanceNotYetCharged = preorder.status === "pending" || preorder.status === "deposit_paid";
  const cancelEligible =
    preorder.status === "deposit_paid" &&
    preorder.balance_charge_status !== "succeeded" &&
    new Date() < new Date(preorder.cancellation_deadline);
  const needsAction = preorder.balance_charge_status === "requires_action";

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>Order {orderRef}</h1>
      <p className={styles.status}>
        Status: <strong>{statusLabel}</strong>
      </p>

      {product?.name && (
        <div className={styles.box}>
          <span className={styles.sectionTitle}>{product.name}</span>
          {configuration?.params && (
            <ul className={styles.list}>
              {Object.entries(configuration.params as Record<string, number>).map(([key, value]) => (
                <li key={key}>
                  <span>{paramLabels[key] ?? key}</span>
                  <span>{value} cm</span>
                </li>
              ))}
            </ul>
          )}
          {product.lead_time_weeks ? (
            <p className={styles.note}>
              Estimated lead time: {product.lead_time_weeks} week
              {product.lead_time_weeks === 1 ? "" : "s"} from production start.
            </p>
          ) : null}
        </div>
      )}

      <div className={styles.box}>
        <span className={styles.sectionTitle}>Amounts</span>
        <ul className={styles.list}>
          <li>
            <span>Total</span>
            <span>{formatMoney(preorder.total_cents, preorder.currency)}</span>
          </li>
          <li>
            <span>Deposit paid</span>
            <span>{formatMoney(preorder.deposit_cents, preorder.currency)}</span>
          </li>
          <li>
            <span>Balance due</span>
            <span>{formatMoney(preorder.balance_cents, preorder.currency)}</span>
          </li>
        </ul>
      </div>

      {balanceNotYetCharged && (
        <p className={styles.note}>
          We'll charge the remaining {formatMoney(preorder.balance_cents, preorder.currency)} on{" "}
          {formatDate(preorder.cancellation_deadline)}. To cancel for a full refund, do so before
          then.
        </p>
      )}

      {needsAction && (
        <p className={styles.actionNote}>
          <a href={`/order/${token}/complete-payment`}>
            Your bank needs you to verify the balance payment — complete it here
          </a>
        </p>
      )}

      {cancelEligible && <CancelButton token={token} />}
    </main>
  );
}
