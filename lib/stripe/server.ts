// FILE: lib/stripe/server.ts
// -----------------------------------------------------------------------------
// Server-ONLY Stripe client, pinned to the API version installed with the SDK
// so payloads/fields can't silently drift out from under the webhook handler.
//
// NEVER import this into a client component or anything shipped to the browser.
// STRIPE_SECRET_KEY is a full-access secret — server env only, no NEXT_PUBLIC_.
// -----------------------------------------------------------------------------

import Stripe from "stripe";

if (typeof window !== "undefined") {
  throw new Error("lib/stripe/server.ts must never be imported in the browser.");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-06-24.dahlia",
});
