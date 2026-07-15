// FILE: lib/email/send.ts
// -----------------------------------------------------------------------------
// Builds and sends each transactional email via the shared sendEmailOnce()
// primitive (lib/email/sendEmailOnce.ts), which owns the send-exactly-once
// bookkeeping in `email_events`. This file only knows how to render each
// email's content from domain data.
// -----------------------------------------------------------------------------

import { render } from "@react-email/components";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmailOnce } from "./sendEmailOnce";
import { DepositReceiptEmail } from "./DepositReceipt";
import { BalanceReminderEmail } from "./BalanceReminder";
import { BalanceActionRequiredEmail } from "./BalanceActionRequired";
import { BalancePaidEmail } from "./BalancePaid";
import { BalanceFailedEmail } from "./BalanceFailed";
import { RefundConfirmationEmail } from "./RefundConfirmation";
import { CancellationConfirmationEmail } from "./CancellationConfirmation";
import { BalanceFinalNoticeEmail } from "./BalanceFinalNotice";

export interface PreorderForEmail {
  id: string;
  lookup_token: string;
  total_cents: number;
  deposit_cents: number;
  balance_cents: number;
  currency: string;
  cancellation_deadline: string;
}

export interface CustomerForEmail {
  email: string;
  name: string | null;
  marketing_consent: boolean;
}

export interface ConfigForEmail {
  productName: string;
  params: Record<string, number>;
  leadTimeWeeks: number | null;
}

function orderRefFor(preorder: PreorderForEmail): string {
  return preorder.lookup_token.slice(0, 8).toUpperCase();
}

export interface PreorderEmailContext {
  preorder: PreorderForEmail;
  customer: CustomerForEmail;
  config: ConfigForEmail;
}

// Shared lookup behind every "send email for this preorder" call site (webhook
// handlers, admin resend button, cron jobs) — one place to fetch the
// preorder/customer/config triple that every transactional email is rendered from.
export async function loadPreorderEmailContext(
  preorderId: string
): Promise<PreorderEmailContext | null> {
  const { data: preorder, error: preorderError } = await supabaseAdmin
    .from("preorders")
    .select(
      "id, lookup_token, total_cents, deposit_cents, balance_cents, currency, cancellation_deadline, customer_id, configuration_id"
    )
    .eq("id", preorderId)
    .maybeSingle();
  if (preorderError || !preorder) {
    console.error("loadPreorderEmailContext: preorder not found", preorderId, preorderError?.message);
    return null;
  }

  const { data: customer, error: customerError } = await supabaseAdmin
    .from("customers")
    .select("email, name, marketing_consent")
    .eq("id", preorder.customer_id)
    .maybeSingle();
  if (customerError || !customer) {
    console.error("loadPreorderEmailContext: customer not found", preorder.customer_id);
    return null;
  }

  const { data: configuration, error: configError } = await supabaseAdmin
    .from("configurations")
    .select("params, products(name, lead_time_weeks)")
    .eq("id", preorder.configuration_id)
    .maybeSingle();
  if (configError || !configuration) {
    console.error("loadPreorderEmailContext: configuration not found", preorder.configuration_id);
    return null;
  }

  const product = Array.isArray(configuration.products)
    ? configuration.products[0]
    : configuration.products;

  return {
    preorder: {
      id: preorder.id,
      lookup_token: preorder.lookup_token,
      total_cents: preorder.total_cents,
      deposit_cents: preorder.deposit_cents,
      balance_cents: preorder.balance_cents,
      currency: preorder.currency,
      cancellation_deadline: preorder.cancellation_deadline,
    },
    customer: {
      email: customer.email,
      name: customer.name,
      marketing_consent: customer.marketing_consent,
    },
    config: {
      productName: product?.name ?? "wit kit",
      params: configuration.params as Record<string, number>,
      leadTimeWeeks: product?.lead_time_weeks ?? null,
    },
  };
}

export async function sendDepositReceipt(
  preorder: PreorderForEmail,
  customer: CustomerForEmail,
  config: ConfigForEmail
): Promise<{ sent: boolean }> {
  const orderRef = orderRefFor(preorder);

  return sendEmailOnce(preorder.id, "deposit_receipt", async () => ({
    to: customer.email,
    subject: `Your wit kit deposit — order ${orderRef}`,
    html: await render(
      DepositReceiptEmail({
        orderRef,
        productName: config.productName,
        params: config.params,
        totalCents: preorder.total_cents,
        depositCents: preorder.deposit_cents,
        balanceCents: preorder.balance_cents,
        currency: preorder.currency,
        cancellationDeadline: preorder.cancellation_deadline,
        leadTimeWeeks: config.leadTimeWeeks,
        orderStatusUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/order/${preorder.lookup_token}`,
        marketingConsent: customer.marketing_consent,
      })
    ),
  }));
}

export async function sendDepositReceiptForPreorder(preorderId: string): Promise<{ sent: boolean }> {
  const ctx = await loadPreorderEmailContext(preorderId);
  if (!ctx) return { sent: false };
  return sendDepositReceipt(ctx.preorder, ctx.customer, ctx.config);
}

export async function sendBalanceReminder(preorderId: string): Promise<{ sent: boolean }> {
  const ctx = await loadPreorderEmailContext(preorderId);
  if (!ctx) return { sent: false };
  const { preorder, customer, config } = ctx;
  const orderRef = orderRefFor(preorder);

  return sendEmailOnce(preorderId, "balance_reminder", async () => ({
    to: customer.email,
    subject: `Your ${config.productName} balance charges on ${new Date(preorder.cancellation_deadline).toLocaleDateString("en-US")} — order ${orderRef}`,
    html: await render(
      BalanceReminderEmail({
        orderRef,
        productName: config.productName,
        balanceCents: preorder.balance_cents,
        currency: preorder.currency,
        cancellationDeadline: preorder.cancellation_deadline,
        orderStatusUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/order/${preorder.lookup_token}`,
      })
    ),
  }));
}

export async function sendBalanceActionRequired(preorderId: string): Promise<{ sent: boolean }> {
  const ctx = await loadPreorderEmailContext(preorderId);
  if (!ctx) return { sent: false };
  const { preorder, customer, config } = ctx;
  const orderRef = orderRefFor(preorder);

  return sendEmailOnce(preorderId, "balance_action_required", async () => ({
    to: customer.email,
    subject: `Action needed to complete your payment — order ${orderRef}`,
    html: await render(
      BalanceActionRequiredEmail({
        orderRef,
        productName: config.productName,
        balanceCents: preorder.balance_cents,
        currency: preorder.currency,
        completePaymentUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/order/${preorder.lookup_token}/complete-payment`,
      })
    ),
  }));
}

export async function sendBalancePaid(preorderId: string): Promise<{ sent: boolean }> {
  const ctx = await loadPreorderEmailContext(preorderId);
  if (!ctx) return { sent: false };
  const { preorder, customer, config } = ctx;
  const orderRef = orderRefFor(preorder);

  return sendEmailOnce(preorderId, "balance_paid", async () => ({
    to: customer.email,
    subject: `Paid in full — order ${orderRef} is entering production`,
    html: await render(
      BalancePaidEmail({
        orderRef,
        productName: config.productName,
        totalCents: preorder.total_cents,
        currency: preorder.currency,
        leadTimeWeeks: config.leadTimeWeeks,
      })
    ),
  }));
}

export async function sendBalanceFailed(preorderId: string): Promise<{ sent: boolean }> {
  const ctx = await loadPreorderEmailContext(preorderId);
  if (!ctx) return { sent: false };
  const { preorder, customer, config } = ctx;
  const orderRef = orderRefFor(preorder);

  return sendEmailOnce(preorderId, "balance_failed", async () => ({
    to: customer.email,
    subject: `We couldn't charge your card — order ${orderRef}`,
    html: await render(
      BalanceFailedEmail({
        orderRef,
        productName: config.productName,
        balanceCents: preorder.balance_cents,
        currency: preorder.currency,
      })
    ),
  }));
}

export async function sendBalanceFinalNotice(preorderId: string): Promise<{ sent: boolean }> {
  const ctx = await loadPreorderEmailContext(preorderId);
  if (!ctx) return { sent: false };
  const { preorder, customer, config } = ctx;
  const orderRef = orderRefFor(preorder);

  return sendEmailOnce(preorderId, "balance_final_notice", async () => ({
    to: customer.email,
    subject: `We still couldn't charge your card — order ${orderRef}`,
    html: await render(
      BalanceFinalNoticeEmail({
        orderRef,
        productName: config.productName,
        balanceCents: preorder.balance_cents,
        currency: preorder.currency,
      })
    ),
  }));
}

// Re-nudges a stale SCA order with the same complete-payment link as the
// original balance_action_required email. Each nudge is a distinct
// email_events type (balance_action_reminder_1, _2, ...) so sendEmailOnce's
// per-type dedup doesn't block the next nudge in the sequence — the caller
// (app/api/cron/nudge-sca) is responsible for picking the right nudgeNumber.
export async function sendBalanceActionReminder(
  preorderId: string,
  nudgeNumber: number
): Promise<{ sent: boolean }> {
  const ctx = await loadPreorderEmailContext(preorderId);
  if (!ctx) return { sent: false };
  const { preorder, customer, config } = ctx;
  const orderRef = orderRefFor(preorder);

  return sendEmailOnce(preorderId, `balance_action_reminder_${nudgeNumber}`, async () => ({
    to: customer.email,
    subject: `Reminder: action needed to complete your payment — order ${orderRef}`,
    html: await render(
      BalanceActionRequiredEmail({
        orderRef,
        productName: config.productName,
        balanceCents: preorder.balance_cents,
        currency: preorder.currency,
        completePaymentUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/order/${preorder.lookup_token}/complete-payment`,
      })
    ),
  }));
}

export async function sendRefundConfirmation(preorderId: string): Promise<{ sent: boolean }> {
  const ctx = await loadPreorderEmailContext(preorderId);
  if (!ctx) return { sent: false };
  const { preorder, customer } = ctx;
  const orderRef = orderRefFor(preorder);

  return sendEmailOnce(preorderId, "refund_confirmation", async () => ({
    to: customer.email,
    subject: `Your refund for order ${orderRef} is complete`,
    html: await render(
      RefundConfirmationEmail({
        orderRef,
        depositCents: preorder.deposit_cents,
        currency: preorder.currency,
      })
    ),
  }));
}

export async function sendCancellationConfirmation(preorderId: string): Promise<{ sent: boolean }> {
  const ctx = await loadPreorderEmailContext(preorderId);
  if (!ctx) return { sent: false };
  const { preorder, customer, config } = ctx;
  const orderRef = orderRefFor(preorder);

  return sendEmailOnce(preorderId, "cancellation_confirmation", async () => ({
    to: customer.email,
    subject: `Order ${orderRef} cancelled`,
    html: await render(
      CancellationConfirmationEmail({
        orderRef,
        productName: config.productName,
        depositCents: preorder.deposit_cents,
        currency: preorder.currency,
      })
    ),
  }));
}
