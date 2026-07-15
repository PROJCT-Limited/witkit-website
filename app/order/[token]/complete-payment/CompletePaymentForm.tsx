// FILE: app/order/[token]/complete-payment/CompletePaymentForm.tsx
// -----------------------------------------------------------------------------
// On-session SCA completion for the balance PaymentIntent. Mirrors
// app/checkout/[preorderId]/PaymentForm.tsx: the client-side confirmPayment()
// result only decides where to navigate — the webhook is still what finalizes
// `confirmed` and balance_charge_status, same rule as every other payment here.
// -----------------------------------------------------------------------------
"use client";

import { useState, type FormEvent } from "react";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

export function CompletePaymentForm({ token }: { token: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/order/${token}` },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed. Please try again.");
      setSubmitting(false);
      return;
    }

    if (paymentIntent && (paymentIntent.status === "succeeded" || paymentIntent.status === "processing")) {
      window.location.href = `/order/${token}`;
      return;
    }

    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <button type="submit" disabled={!stripe || submitting}>
        {submitting ? "Processing…" : "Complete payment"}
      </button>
      <p style={{ fontSize: 12, color: "#888" }}>Powered by Stripe.</p>
    </form>
  );
}
