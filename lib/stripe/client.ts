// FILE: lib/stripe/client.ts
// -----------------------------------------------------------------------------
// Browser-side Stripe.js singleton. Uses ONLY the publishable key — never
// import lib/stripe/server.ts (the secret-key client) from here or from any
// client component.
// -----------------------------------------------------------------------------
"use client";

import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";

let stripePromise: Promise<StripeJs | null> | null = null;

export function getStripe(): Promise<StripeJs | null> {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return stripePromise;
}
