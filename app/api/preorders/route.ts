// FILE: app/api/preorders/route.ts
// -----------------------------------------------------------------------------
// POST /api/preorders
// Turns a saved configuration into a preorder and starts the 20% deposit charge.
//   1. Load the configuration — its stored price_cents is the ONLY trusted total.
//   2. Upsert the customer (by email) + the matching Stripe Customer.
//   3. Insert the preorder (status: pending), amounts frozen from the config.
//   4. Create the deposit PaymentIntent (card saved for the Step-5 balance charge).
//   5. Return { preorderId, clientSecret } — nothing here is marked "paid".
// Payment truth comes from the webhook (app/api/webhooks/stripe/route.ts), never
// from this route or from the browser.
// -----------------------------------------------------------------------------

import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";

interface ShippingInput {
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode: string;
  country: string;
}

interface CustomerInput {
  email: string;
  name: string;
  phone?: string;
}

interface ConfigurationRow {
  id: string;
  price_cents: number;
  currency: string;
}

interface CustomerRow {
  id: string;
  email: string;
  stripe_customer_id: string | null;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function parseShipping(raw: unknown): ShippingInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const s = raw as Record<string, unknown>;
  if (
    !isNonEmptyString(s.line1) ||
    !isNonEmptyString(s.city) ||
    !isNonEmptyString(s.postalCode) ||
    !isNonEmptyString(s.country)
  ) {
    return null;
  }
  return {
    line1: s.line1 as string,
    line2: isNonEmptyString(s.line2) ? (s.line2 as string) : undefined,
    city: s.city as string,
    region: isNonEmptyString(s.region) ? (s.region as string) : undefined,
    postalCode: s.postalCode as string,
    country: s.country as string,
  };
}

function parseCustomer(raw: unknown): CustomerInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const c = raw as Record<string, unknown>;
  if (!isNonEmptyString(c.email) || !isNonEmptyString(c.name)) return null;
  return {
    email: (c.email as string).trim().toLowerCase(),
    name: c.name as string,
    phone: isNonEmptyString(c.phone) ? (c.phone as string) : undefined,
  };
}

// 32 random bytes hex-encoded: unguessable, URL-safe, used for the guest
// order-status link (`/order/:lookup_token`) — no auth required to view it.
function generateLookupToken(): string {
  return randomBytes(32).toString("hex");
}

async function upsertCustomer(
  input: CustomerInput,
  marketingConsent: boolean
): Promise<CustomerRow> {
  const { data: existing, error: selectError } = await supabaseAdmin
    .from("customers")
    .select("id, email, stripe_customer_id")
    .eq("email", input.email)
    .maybeSingle();

  if (selectError) throw new Error(`customer lookup failed: ${selectError.message}`);

  const patch: Record<string, unknown> = {
    name: input.name,
    phone: input.phone ?? null,
  };
  if (marketingConsent) {
    patch.marketing_consent = true;
    patch.consent_at = new Date().toISOString();
  }

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("customers")
      .update(patch)
      .eq("id", existing.id)
      .select("id, email, stripe_customer_id")
      .single();
    if (error) throw new Error(`customer update failed: ${error.message}`);
    return data as CustomerRow;
  }

  const { data, error } = await supabaseAdmin
    .from("customers")
    .insert({ email: input.email, ...patch })
    .select("id, email, stripe_customer_id")
    .single();
  if (error) throw new Error(`customer insert failed: ${error.message}`);
  return data as CustomerRow;
}

async function getOrCreateStripeCustomer(customer: CustomerRow, name: string): Promise<string> {
  if (customer.stripe_customer_id) return customer.stripe_customer_id;

  const stripeCustomer = await stripe.customers.create({
    email: customer.email,
    name,
    metadata: { customer_id: customer.id },
  });

  const { error } = await supabaseAdmin
    .from("customers")
    .update({ stripe_customer_id: stripeCustomer.id })
    .eq("id", customer.id);
  if (error) throw new Error(`customer stripe_customer_id save failed: ${error.message}`);

  return stripeCustomer.id;
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: ["Invalid JSON body."] }, { status: 400 });
  }

  if (body?.termsAgreed !== true) {
    return NextResponse.json(
      { errors: ["You must agree to the payment terms."] },
      { status: 400 }
    );
  }

  const configurationId = isNonEmptyString(body?.configurationId) ? body.configurationId : null;
  const customerInput = parseCustomer(body?.customer);
  const shipping = parseShipping(body?.shipping);
  const marketingConsent = body?.marketingConsent === true;

  if (!configurationId) {
    return NextResponse.json({ errors: ["`configurationId` is required."] }, { status: 400 });
  }
  if (!customerInput) {
    return NextResponse.json(
      { errors: ["`customer.email` and `customer.name` are required."] },
      { status: 400 }
    );
  }
  if (!shipping) {
    return NextResponse.json(
      { errors: ["A complete shipping address is required."] },
      { status: 400 }
    );
  }

  const { data: configuration, error: configError } = await supabaseAdmin
    .from("configurations")
    .select("id, price_cents, currency")
    .eq("id", configurationId)
    .maybeSingle();

  if (configError) {
    console.error("configuration lookup failed:", configError.message);
    return NextResponse.json({ errors: ["Could not load configuration."] }, { status: 500 });
  }
  if (!configuration) {
    return NextResponse.json({ errors: ["Configuration not found."] }, { status: 404 });
  }

  const config = configuration as ConfigurationRow;
  // The only trusted amount: whatever pricing.ts computed and stored at step 2.
  const totalCents = config.price_cents;
  const depositCents = Math.round(totalCents * 0.2);
  const balanceCents = totalCents - depositCents;

  const cancellationDeadline = process.env.CANCELLATION_DEADLINE;
  if (!cancellationDeadline) {
    console.error("CANCELLATION_DEADLINE is not set.");
    return NextResponse.json({ errors: ["Checkout is misconfigured."] }, { status: 500 });
  }

  let customer: CustomerRow;
  let stripeCustomerId: string;
  try {
    customer = await upsertCustomer(customerInput, marketingConsent);
    stripeCustomerId = await getOrCreateStripeCustomer(customer, customerInput.name);
  } catch (err) {
    console.error("customer setup failed:", (err as Error).message);
    return NextResponse.json({ errors: ["Could not set up customer."] }, { status: 500 });
  }

  const lookupToken = generateLookupToken();
  const nowIso = new Date().toISOString();

  const { data: preorder, error: preorderError } = await supabaseAdmin
    .from("preorders")
    .insert({
      customer_id: customer.id,
      configuration_id: config.id,
      status: "pending",
      currency: config.currency,
      total_cents: totalCents,
      deposit_cents: depositCents,
      balance_cents: balanceCents,
      shipping_snapshot: shipping,
      stripe_customer_id: stripeCustomerId,
      lookup_token: lookupToken,
      cancellation_deadline: new Date(cancellationDeadline).toISOString(),
      terms_agreed_at: nowIso,
    })
    .select("id")
    .single();

  if (preorderError) {
    console.error("preorder insert failed:", preorderError.message);
    return NextResponse.json({ errors: ["Could not create preorder."] }, { status: 500 });
  }

  const preorderId = preorder.id as string;

  let clientSecret: string | null;
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: depositCents,
      currency: "usd",
      customer: stripeCustomerId,
      setup_future_usage: "off_session",
      automatic_payment_methods: { enabled: true },
      metadata: {
        preorder_id: preorderId,
        configuration_id: config.id,
        kind: "deposit",
      },
    });
    clientSecret = paymentIntent.client_secret;

    const { error: updateError } = await supabaseAdmin
      .from("preorders")
      .update({ stripe_deposit_pi_id: paymentIntent.id })
      .eq("id", preorderId);
    if (updateError) {
      console.error("preorder pi id save failed:", updateError.message);
    }
  } catch (err) {
    console.error("deposit payment intent creation failed:", (err as Error).message);
    return NextResponse.json({ errors: ["Could not start payment."] }, { status: 500 });
  }

  return NextResponse.json({ preorderId, clientSecret }, { status: 201 });
}
