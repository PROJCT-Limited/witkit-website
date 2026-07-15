// FILE: app/admin/page.tsx
// -----------------------------------------------------------------------------
// GET /admin — preorder list, newest first, optional ?status= filter.
// Protected by proxy.ts (HTTP Basic Auth). Service-role reads only.
// -----------------------------------------------------------------------------

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface Row {
  id: string;
  created_at: string;
  status: string;
  balance_charge_status: string | null;
  total_cents: number;
  deposit_cents: number;
  balance_cents: number;
  currency: string;
  cancellation_deadline: string;
  balance_abandoned_at: string | null;
  customers: { email: string } | { email: string }[] | null;
  configurations: {
    params: Record<string, number>;
    products: { name: string } | { name: string }[] | null;
  } | null;
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const STATUSES = [
  "pending",
  "deposit_paid",
  "confirmed",
  "cancelled",
  "refunded",
  "in_production",
  "fulfilled",
];

const BALANCE_FILTERS = [
  { key: "failed", label: "balance failed" },
  { key: "requires_action", label: "needs SCA" },
  { key: "abandoned", label: "abandoned" },
];

export default async function AdminPreorderListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; balance?: string }>;
}) {
  const { status, balance } = await searchParams;

  let query = supabaseAdmin
    .from("preorders")
    .select(
      "id, created_at, status, balance_charge_status, total_cents, deposit_cents, balance_cents, currency, cancellation_deadline, balance_abandoned_at, customers(email), configurations(params, products(name))"
    )
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (balance === "abandoned") {
    query = query.not("balance_abandoned_at", "is", null);
  } else if (balance) {
    query = query.eq("balance_charge_status", balance);
  }

  const { data, error } = await query;

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 32 }}>
      <h1>Preorders</h1>

      <p>
        Status:{" "}
        <Link href={balance ? `/admin?balance=${balance}` : "/admin"} style={{ fontWeight: status ? "normal" : "bold" }}>
          all
        </Link>{" "}
        {STATUSES.map((s) => (
          <span key={s}>
            {" · "}
            <Link
              href={`/admin?status=${s}${balance ? `&balance=${balance}` : ""}`}
              style={{ fontWeight: status === s ? "bold" : "normal" }}
            >
              {s}
            </Link>
          </span>
        ))}
      </p>

      <p>
        Balance:{" "}
        <Link href={status ? `/admin?status=${status}` : "/admin"} style={{ fontWeight: balance ? "normal" : "bold" }}>
          all
        </Link>{" "}
        {BALANCE_FILTERS.map((f) => (
          <span key={f.key}>
            {" · "}
            <Link
              href={`/admin?balance=${f.key}${status ? `&status=${status}` : ""}`}
              style={{ fontWeight: balance === f.key ? "bold" : "normal" }}
            >
              {f.label}
            </Link>
          </span>
        ))}
      </p>

      {error && <p style={{ color: "crimson" }}>Failed to load: {error.message}</p>}

      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #ccc" }}>
            <th style={{ padding: 6 }}>Created</th>
            <th style={{ padding: 6 }}>Ref</th>
            <th style={{ padding: 6 }}>Customer</th>
            <th style={{ padding: 6 }}>Product</th>
            <th style={{ padding: 6 }}>Spec (w×d×h)</th>
            <th style={{ padding: 6 }}>Total</th>
            <th style={{ padding: 6 }}>Deposit</th>
            <th style={{ padding: 6 }}>Balance</th>
            <th style={{ padding: 6 }}>Status</th>
            <th style={{ padding: 6 }}>Balance charge</th>
            <th style={{ padding: 6 }}>Deadline</th>
          </tr>
        </thead>
        <tbody>
          {(data as Row[] | null ?? []).map((row) => {
            const customer = one(row.customers);
            const config = row.configurations;
            const product = config ? one(config.products) : null;
            const p = config?.params ?? {};
            return (
              <tr key={row.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 6 }}>{new Date(row.created_at).toLocaleDateString("en-US")}</td>
                <td style={{ padding: 6 }}>
                  <Link href={`/admin/preorders/${row.id}`}>{row.id.slice(0, 8).toUpperCase()}</Link>
                </td>
                <td style={{ padding: 6 }}>{customer?.email ?? "—"}</td>
                <td style={{ padding: 6 }}>{product?.name ?? "—"}</td>
                <td style={{ padding: 6 }}>
                  {p.width ?? "?"}×{p.depth ?? "?"}×{p.height ?? "?"}
                </td>
                <td style={{ padding: 6 }}>{formatMoney(row.total_cents, row.currency)}</td>
                <td style={{ padding: 6 }}>{formatMoney(row.deposit_cents, row.currency)}</td>
                <td style={{ padding: 6 }}>{formatMoney(row.balance_cents, row.currency)}</td>
                <td style={{ padding: 6 }}>{row.status}</td>
                <td style={{ padding: 6, color: row.balance_abandoned_at ? "crimson" : undefined }}>
                  {row.balance_abandoned_at ? "abandoned" : (row.balance_charge_status ?? "—")}
                </td>
                <td style={{ padding: 6 }}>
                  {new Date(row.cancellation_deadline).toLocaleDateString("en-US")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {data && data.length === 0 && (
        <p>
          No preorders{status ? ` with status "${status}"` : ""}
          {balance ? ` matching balance filter "${balance}"` : ""}.
        </p>
      )}
    </main>
  );
}
