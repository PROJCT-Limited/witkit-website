// FILE: app/order/[token]/complete-payment/CompletePaymentClient.tsx
// -----------------------------------------------------------------------------
// Mounts Stripe Elements around the balance PaymentIntent's client_secret.
// -----------------------------------------------------------------------------
"use client";

import { Elements } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe/client";
import { stripeAppearance } from "@/app/checkout/stripeAppearance";
import { CompletePaymentForm } from "./CompletePaymentForm";

export function CompletePaymentClient({
  clientSecret,
  token,
}: {
  clientSecret: string;
  token: string;
}) {
  return (
    <Elements stripe={getStripe()} options={{ clientSecret, appearance: stripeAppearance }}>
      <CompletePaymentForm token={token} />
    </Elements>
  );
}
