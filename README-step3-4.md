# wit kit — Steps 3 & 4: deposit checkout + confirmation email

Turns a saved configuration into a preorder, takes a 20% deposit via Stripe
(saving the card for the Step-5 balance charge), and emails a receipt once the
webhook confirms payment. Reuses steps 1–2 unchanged.

## Where everything lives

| Concern                                   | File                                          |
|--------------------------------------------|------------------------------------------------|
| Migration (new tables)                     | `migrations/002_preorders.sql`                 |
| Server-only Stripe client                  | `lib/stripe/server.ts`                         |
| Browser Stripe.js singleton                | `lib/stripe/client.ts`                         |
| Create preorder + deposit PaymentIntent    | `app/api/preorders/route.ts`                   |
| Poll a preorder's (non-PII) status         | `app/api/preorders/[id]/route.ts`              |
| Webhook — the only source of payment truth | `app/api/webhooks/stripe/route.ts`             |
| Email template                             | `lib/email/DepositReceipt.tsx`                 |
| Email sender (idempotent)                  | `lib/email/send.ts`                            |
| Checkout: details form                     | `app/checkout/page.tsx`, `app/checkout/DetailsForm.tsx` |
| Checkout: payment step (Payment Element)   | `app/checkout/[preorderId]/page.tsx`, `PaymentForm.tsx` |
| Post-payment holding page                  | `app/checkout/[preorderId]/thank-you/page.tsx` |
| Order-status link target (stub)            | `app/order/[token]/page.tsx`                   |

## Setup

```bash
npm install stripe @stripe/stripe-js @stripe/react-stripe-js resend @react-email/components
```

1. Run `migrations/002_preorders.sql` in Supabase (after `schema.sql`).
2. Copy `.env.local.example` → `.env.local` and fill in real test-mode keys.
3. `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, put the
   printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`, restart the dev server.

## The flow

1. `GET /checkout?configurationId=...` — details form (email, name, shipping,
   required payment-terms checkbox, separate unticked marketing checkbox).
2. `POST /api/preorders` — loads the configuration's `price_cents` (the only
   trusted amount), upserts the customer + Stripe Customer, inserts the
   `preorders` row, creates the deposit PaymentIntent with
   `setup_future_usage: "off_session"`, returns `{ preorderId, clientSecret }`.
3. Browser mounts the Stripe Payment Element with that `clientSecret` and
   confirms payment.
4. Stripe calls `POST /api/webhooks/stripe` with `payment_intent.succeeded`.
   The handler records the `payments` row, flips `preorders.status` to
   `deposit_paid`, and sends the deposit receipt email.
5. The thank-you page polls `GET /api/preorders/:id` until status leaves
   `pending` — the browser's own `confirmPayment()` result is never trusted
   as proof of payment.

## Idempotency (why replays are safe)

- `payments.stripe_payment_intent_id` is unique — a replayed
  `payment_intent.succeeded` event fails that insert and the handler returns
  without re-updating state.
- `email_events (preorder_id, type)` is unique — `sendDepositReceipt` inserts
  a `status: "sending"` row *before* calling Resend; a concurrent/retried
  delivery loses that insert race and never sends a second email.

## Acceptance test (Stripe test mode)

1. Create a configuration (steps 1–2), note its id.
2. Visit `/checkout?configurationId=<id>`, fill the form, submit.
3. On the payment step, pay with `4242 4242 4242 4242`, any future
   expiry/CVC.
4. Verify: `preorders.status = 'deposit_paid'`; one `payments` row
   (`type = 'deposit'`, `amount_cents` = 20% of total); `stripe_payment_method_id`
   populated; one `email_events` row `(…, 'deposit_receipt', 'sent')`;
   confirmation email received.
5. In the Stripe CLI, resend the `payment_intent.succeeded` event — confirm no
   duplicate `payments` row and no second email.
6. For the $305 stool: deposit = **$61.00**, balance = **$244.00**.

## Not included yet (Step 5)

The scheduled off-session balance charge, the pre-charge reminder email, the
SCA-fallback flow, and the cancel + refund endpoint. `app/order/[token]/page.tsx`
is a stub — real order lookup-by-token is part of that later step.
