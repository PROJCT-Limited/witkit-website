// FILE: app/checkout/[preorderId]/thank-you/page.tsx
// -----------------------------------------------------------------------------
// Landed here right after confirmPayment() resolves — payment may still only
// be "processing" from Stripe's point of view. We poll GET /api/preorders/:id
// (populated by the webhook) rather than trust the client-side result, per the
// rule that payment truth only ever comes from the webhook.
// -----------------------------------------------------------------------------
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import styles from "@/app/checkout/checkout.module.css";

interface PreorderSummary {
  status: string;
  lookupToken: string;
}

export default function ThankYouPage() {
  const { preorderId } = useParams<{ preorderId: string }>();
  const [summary, setSummary] = useState<PreorderSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll(attempt: number) {
      try {
        const res = await fetch(`/api/preorders/${preorderId}`);
        if (res.ok) {
          const data = (await res.json()) as PreorderSummary;
          if (cancelled) return;
          setSummary(data);
          if (data.status !== "pending") return;
        }
      } catch {
        // transient — keep polling until the attempt budget runs out
      }
      if (!cancelled && attempt < 10) {
        setTimeout(() => poll(attempt + 1), 2000);
      }
    }

    poll(0);
    return () => {
      cancelled = true;
    };
  }, [preorderId]);

  const confirmed = summary != null && summary.status !== "pending";

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>{confirmed ? "Deposit confirmed" : "Confirming your payment…"}</h1>
      <p className={styles.lead}>
        {confirmed
          ? "Thanks — your deposit is confirmed and a receipt is on its way to your inbox."
          : "This only takes a moment. Don't close this tab."}
      </p>
      {summary?.lookupToken && (
        <p>
          <a href={`/order/${summary.lookupToken}`}>View your order status</a>
        </p>
      )}
    </main>
  );
}
