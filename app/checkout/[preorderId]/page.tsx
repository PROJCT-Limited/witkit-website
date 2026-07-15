// FILE: app/checkout/[preorderId]/page.tsx
// -----------------------------------------------------------------------------
// Step 2 of guest checkout: mount the Stripe Payment Element with the
// clientSecret handed off from the details form via sessionStorage (set in
// app/checkout/DetailsForm.tsx). If it's missing — direct nav, expired tab,
// page refresh after the secret was already consumed — send the guest back
// to start over rather than re-creating a PaymentIntent here.
// -----------------------------------------------------------------------------
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Elements } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe/client";
import { PaymentForm } from "./PaymentForm";

export default function CheckoutPaymentPage() {
  const { preorderId } = useParams<{ preorderId: string }>();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(`witkit:checkout:${preorderId}`);
    if (!stored) {
      setMissing(true);
      return;
    }
    setClientSecret(stored);
  }, [preorderId]);

  if (missing) {
    return (
      <main style={{ maxWidth: 480, margin: "0 auto", padding: 32 }}>
        <p>
          Your checkout session expired, or this page was opened directly.{" "}
          <a href="/checkout">Start checkout again</a>.
        </p>
      </main>
    );
  }

  if (!clientSecret) return null;

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 32 }}>
      <h1>Payment</h1>
      <Elements stripe={getStripe()} options={{ clientSecret }}>
        <PaymentForm preorderId={preorderId} />
      </Elements>
    </main>
  );
}
