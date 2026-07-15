// FILE: app/admin/preorders/[id]/page.tsx
// -----------------------------------------------------------------------------
// GET /admin/preorders/:id — full detail: config spec, amounts, payments,
// email_events (with status/error), shipping snapshot, Stripe ids (admin may
// see these, unlike the customer-facing /order/[token] page), and actions.
// -----------------------------------------------------------------------------

import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AdminActions } from "./AdminActions";

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US");
}

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function AdminPreorderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: preorder } = await supabaseAdmin
    .from("preorders")
    .select(
      "id, created_at, status, balance_charge_status, total_cents, deposit_cents, balance_cents, currency, cancellation_deadline, shipping_snapshot, stripe_customer_id, stripe_deposit_pi_id, stripe_balance_pi_id, stripe_payment_method_id, lookup_token, customer_id, configuration_id, balance_attempts, last_balance_attempt_at, balance_abandoned_at, last_error, last_error_at, non_card_error_count"
    )
    .eq("id", id)
    .maybeSingle();

  if (!preorder) notFound();

  const [{ data: customer }, { data: configuration }, { data: payments }, { data: emailEvents }] =
    await Promise.all([
      supabaseAdmin
        .from("customers")
        .select("email, name, phone")
        .eq("id", preorder.customer_id)
        .maybeSingle(),
      supabaseAdmin
        .from("configurations")
        .select("params, products(name, lead_time_weeks)")
        .eq("id", preorder.configuration_id)
        .maybeSingle(),
      supabaseAdmin
        .from("payments")
        .select("id, stripe_payment_intent_id, type, amount_cents, status, created_at")
        .eq("preorder_id", id)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("email_events")
        .select("id, type, status, provider_id, error, sent_at, updated_at")
        .eq("preorder_id", id)
        .order("sent_at", { ascending: true }),
    ]);

  const product = configuration ? one(configuration.products) : null;
  const shipping = preorder.shipping_snapshot as Record<string, string>;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 32 }}>
      <p>
        <a href="/admin">&larr; All preorders</a>
      </p>
      <h1>Order {id.slice(0, 8).toUpperCase()}</h1>
      <p>
        Status: <strong>{preorder.status}</strong> · Balance charge:{" "}
        <strong>{preorder.balance_charge_status ?? "—"}</strong>
      </p>
      <p>Created: {formatDateTime(preorder.created_at)}</p>

      <h2 style={{ fontSize: 16 }}>Customer</h2>
      <ul>
        <li>Email: {customer?.email ?? "—"}</li>
        <li>Name: {customer?.name ?? "—"}</li>
        <li>Phone: {customer?.phone ?? "—"}</li>
      </ul>

      <h2 style={{ fontSize: 16 }}>Shipping</h2>
      <ul>
        <li>{shipping?.line1}</li>
        {shipping?.line2 && <li>{shipping.line2}</li>}
        <li>
          {shipping?.city}
          {shipping?.region ? `, ${shipping.region}` : ""} {shipping?.postalCode}
        </li>
        <li>{shipping?.country}</li>
      </ul>

      <h2 style={{ fontSize: 16 }}>{product?.name ?? "Configuration"}</h2>
      <ul>
        {configuration &&
          Object.entries(configuration.params as Record<string, number>).map(([k, v]) => (
            <li key={k}>
              {k}: {v}
            </li>
          ))}
      </ul>
      {product?.lead_time_weeks ? <p>Lead time: {product.lead_time_weeks} weeks</p> : null}

      <h2 style={{ fontSize: 16 }}>Amounts</h2>
      <ul>
        <li>Total: {formatMoney(preorder.total_cents, preorder.currency)}</li>
        <li>Deposit: {formatMoney(preorder.deposit_cents, preorder.currency)}</li>
        <li>Balance: {formatMoney(preorder.balance_cents, preorder.currency)}</li>
        <li>Cancellation / balance-charge deadline: {formatDateTime(preorder.cancellation_deadline)}</li>
        <li>Balance charge attempts: {preorder.balance_attempts}</li>
        <li>
          Last balance attempt:{" "}
          {preorder.last_balance_attempt_at ? formatDateTime(preorder.last_balance_attempt_at) : "—"}
        </li>
        {preorder.balance_abandoned_at && (
          <li style={{ color: "crimson" }}>
            Abandoned: {formatDateTime(preorder.balance_abandoned_at)} — needs a human
          </li>
        )}
        {preorder.non_card_error_count > 0 && (
          <li style={{ color: "crimson" }}>
            Non-card ops errors: {preorder.non_card_error_count} · last{" "}
            {preorder.last_error_at ? formatDateTime(preorder.last_error_at) : "—"} · {preorder.last_error}
            <br />
            <span style={{ fontWeight: "normal", color: "#555" }}>
              Still being retried by the daily cron (self-healing) — investigate if this keeps climbing.
            </span>
          </li>
        )}
      </ul>

      <h2 style={{ fontSize: 16 }}>Stripe</h2>
      <ul style={{ fontSize: 13, fontFamily: "monospace" }}>
        <li>Customer: {preorder.stripe_customer_id ?? "—"}</li>
        <li>Payment method: {preorder.stripe_payment_method_id ?? "—"}</li>
        <li>Deposit PI: {preorder.stripe_deposit_pi_id ?? "—"}</li>
        <li>Balance PI: {preorder.stripe_balance_pi_id ?? "—"}</li>
      </ul>

      <h2 style={{ fontSize: 16 }}>Payments</h2>
      <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th style={{ padding: 4 }}>Type</th>
            <th style={{ padding: 4 }}>Amount</th>
            <th style={{ padding: 4 }}>Status</th>
            <th style={{ padding: 4 }}>Created</th>
            <th style={{ padding: 4 }}>PI</th>
          </tr>
        </thead>
        <tbody>
          {(payments ?? []).map((p) => (
            <tr key={p.id}>
              <td style={{ padding: 4 }}>{p.type}</td>
              <td style={{ padding: 4 }}>{formatMoney(p.amount_cents, preorder.currency)}</td>
              <td style={{ padding: 4 }}>{p.status}</td>
              <td style={{ padding: 4 }}>{formatDateTime(p.created_at)}</td>
              <td style={{ padding: 4, fontFamily: "monospace" }}>{p.stripe_payment_intent_id}</td>
            </tr>
          ))}
          {(!payments || payments.length === 0) && (
            <tr>
              <td style={{ padding: 4 }} colSpan={5}>
                No payments yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2 style={{ fontSize: 16 }}>Emails</h2>
      <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th style={{ padding: 4 }}>Type</th>
            <th style={{ padding: 4 }}>Status</th>
            <th style={{ padding: 4 }}>Error</th>
            <th style={{ padding: 4 }}>Updated</th>
          </tr>
        </thead>
        <tbody>
          {(emailEvents ?? []).map((e) => (
            <tr key={e.id}>
              <td style={{ padding: 4 }}>{e.type}</td>
              <td style={{ padding: 4 }}>{e.status}</td>
              <td style={{ padding: 4, color: e.error ? "crimson" : undefined }}>{e.error ?? "—"}</td>
              <td style={{ padding: 4 }}>{formatDateTime(e.updated_at ?? e.sent_at)}</td>
            </tr>
          ))}
          {(!emailEvents || emailEvents.length === 0) && (
            <tr>
              <td style={{ padding: 4 }} colSpan={4}>
                No emails yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2 style={{ fontSize: 16 }}>Actions</h2>
      <AdminActions
        preorderId={id}
        status={preorder.status}
        balanceChargeStatus={preorder.balance_charge_status}
        balanceAbandonedAt={preorder.balance_abandoned_at}
      />
    </main>
  );
}
