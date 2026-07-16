// FILE: app/order/[token]/CancelButton.tsx
// -----------------------------------------------------------------------------
// Client-side cancel action for the order-status page. Only rendered by the
// server component when the order is actually eligible (deposit_paid, before
// the deadline) — the API route re-checks eligibility regardless.
// -----------------------------------------------------------------------------
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import styles from "@/app/order/order.module.css";

export function CancelButton({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    if (!window.confirm("Cancel this order? Your deposit will be refunded in full.")) return;
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/preorders/${token}/cancel`, { method: "POST" });
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      setError(body?.errors?.join(" ") ?? "Could not cancel this order.");
      setBusy(false);
      return;
    }

    router.refresh();
  }

  return (
    <div>
      <Button onClick={handleCancel} loading={busy} loadingText="Cancelling…">
        Cancel order
      </Button>
      {error && <p className={styles.errorText}>{error}</p>}
    </div>
  );
}
