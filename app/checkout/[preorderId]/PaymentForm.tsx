// FILE: app/checkout/[preorderId]/PaymentForm.tsx
// -----------------------------------------------------------------------------
// Renders the Payment Element and confirms the deposit. The browser's
// confirmPayment() result is only used to decide where to navigate next —
// the preorder is never marked paid here. The webhook
// (app/api/webhooks/stripe/route.ts) is the only thing that flips
// preorders.status, which is why the thank-you page polls GET /api/preorders/:id
// instead of trusting this client-side result.
// -----------------------------------------------------------------------------
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

interface PreorderSummary {
  depositCents: number;
  balanceCents: number;
  currency: string;
  cancellationDeadline: string;
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export function PaymentForm({ preorderId }: { preorderId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [summary, setSummary] = useState<PreorderSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/preorders/${preorderId}`)
      .then((res) => res.json())
      .then((data) => setSummary(data))
      .catch(() => {
        /* summary is a nice-to-have; the Payment Element still works without it */
      });
  }, [preorderId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/${preorderId}/thank-you`,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed. Please try again.");
      setSubmitting(false);
      return;
    }

    if (paymentIntent && (paymentIntent.status === "succeeded" || paymentIntent.status === "processing")) {
      window.location.href = `/checkout/${preorderId}/thank-you`;
      return;
    }

    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      {summary && (
        <p>
          Deposit due now: <strong>{formatMoney(summary.depositCents, summary.currency)}</strong>
          <br />
          Balance due {new Date(summary.cancellationDeadline).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          : <strong>{formatMoney(summary.balanceCents, summary.currency)}</strong>
        </p>
      )}

      <PaymentElement />

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <button type="submit" disabled={!stripe || submitting}>
        {submitting ? "Processing…" : "Pay deposit"}
      </button>

      <p style={{ fontSize: 12, color: "#888" }}>Powered by Stripe.</p>
    </form>
  );
}
