// FILE: app/admin/preorders/[id]/AdminActions.tsx
// -----------------------------------------------------------------------------
// Client-side action buttons for the admin detail page. Each POSTs to its
// route (protected by proxy.ts — the browser already has Basic Auth
// cached for this origin/realm, so fetch() sends it automatically) and then
// refreshes the server component to reflect the new state.
// -----------------------------------------------------------------------------
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  preorderId: string;
  status: string;
  balanceChargeStatus: string | null;
  balanceAbandonedAt: string | null;
}

async function postJson(url: string, payload?: unknown): Promise<{ ok: boolean; body: any }> {
  const res = await fetch(url, {
    method: "POST",
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* no body */
  }
  return { ok: res.ok, body };
}

export function AdminActions({ preorderId, status, balanceChargeStatus, balanceAbandonedAt }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: string, url: string, payload?: unknown, confirmMessage?: string) {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setBusy(action);
    setMessage(null);
    const { ok, body } = await postJson(url, payload);
    setBusy(null);
    setMessage(ok ? "Done." : (body?.errors?.join(" ") ?? "Failed."));
    router.refresh();
  }

  const canChargeBalance =
    status === "deposit_paid" && balanceChargeStatus !== "succeeded";
  const canCancel = status === "deposit_paid";
  const canResetRetry = status === "deposit_paid" && balanceChargeStatus === "failed";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
      <button
        disabled={busy !== null}
        onClick={() => run("resend", `/api/admin/preorders/${preorderId}/resend-receipt`)}
      >
        {busy === "resend" ? "Sending…" : "Resend deposit receipt"}
      </button>

      {status === "deposit_paid" || status === "confirmed" ? (
        <button
          disabled={busy !== null}
          onClick={() =>
            run("in_production", `/api/admin/preorders/${preorderId}/status`, {
              status: "in_production",
            })
          }
        >
          {busy === "in_production" ? "Updating…" : "Mark in production"}
        </button>
      ) : null}

      {status === "in_production" ? (
        <button
          disabled={busy !== null}
          onClick={() =>
            run("fulfilled", `/api/admin/preorders/${preorderId}/status`, {
              status: "fulfilled",
            })
          }
        >
          {busy === "fulfilled" ? "Updating…" : "Mark fulfilled"}
        </button>
      ) : null}

      {canChargeBalance && (
        <button
          disabled={busy !== null}
          onClick={() =>
            run(
              "charge",
              `/api/admin/preorders/${preorderId}/charge-balance`,
              undefined,
              "Charge the remaining balance to the saved card now?"
            )
          }
        >
          {busy === "charge" ? "Charging…" : "Charge balance now"}
        </button>
      )}

      {canResetRetry && (
        <button
          disabled={busy !== null}
          onClick={() =>
            run(
              "reset-retry",
              `/api/admin/preorders/${preorderId}/reset-retry-balance`,
              undefined,
              balanceAbandonedAt
                ? "This order was abandoned after too many failed attempts. Reset and try the saved card again?"
                : "Try the saved card again now?"
            )
          }
        >
          {busy === "reset-retry" ? "Retrying…" : "Reset & retry balance"}
        </button>
      )}

      {canCancel && (
        <button
          disabled={busy !== null}
          onClick={() =>
            run(
              "cancel",
              `/api/admin/preorders/${preorderId}/cancel`,
              undefined,
              "Cancel this order and refund the deposit?"
            )
          }
        >
          {busy === "cancel" ? "Cancelling…" : "Cancel + refund deposit"}
        </button>
      )}

      {message && <p style={{ fontSize: 13, color: "#555" }}>{message}</p>}
    </div>
  );
}
