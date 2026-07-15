// FILE: lib/email/sendEmailOnce.ts
// -----------------------------------------------------------------------------
// Shared send-exactly-once primitive for every transactional email in the app.
// Idempotency keys on "is there a `sent` row for (preorderId, type)?" — not on
// "does a row exist?" — so a `failed` or stuck `pending` row is safely
// retryable (by a webhook retry, a cron re-run, or the admin resend button),
// while a `sent` row still blocks duplicates for good.
//
// Known, accepted race: two truly SIMULTANEOUS callers for the same
// (preorderId, type) that both see a non-`sent` row could both reclaim it and
// both send — the reclaim is a plain UPDATE, not constraint-guarded, unlike
// the very first insert (which IS protected by the email_events unique
// constraint). Stripe's webhook retries are sequential/spaced out, so at this
// volume that window is not worth the extra locking complexity.
// -----------------------------------------------------------------------------

import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase/admin";

const resend = new Resend(process.env.RESEND_API_KEY!);

export interface EmailToSend {
  to: string;
  subject: string;
  html: string;
}

export interface SendEmailOnceResult {
  sent: boolean;
}

export async function sendEmailOnce(
  preorderId: string,
  type: string,
  render: () => Promise<EmailToSend>
): Promise<SendEmailOnceResult> {
  const nowIso = () => new Date().toISOString();

  const { data: existing, error: selectError } = await supabaseAdmin
    .from("email_events")
    .select("id, status")
    .eq("preorder_id", preorderId)
    .eq("type", type)
    .maybeSingle();

  if (selectError) {
    console.error(`sendEmailOnce(${type}): lookup failed:`, selectError.message);
    return { sent: false };
  }

  if (existing?.status === "sent") {
    return { sent: false };
  }

  let eventId: string;
  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("email_events")
      .update({ status: "pending", error: null, updated_at: nowIso() })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) {
      console.error(`sendEmailOnce(${type}): reclaim failed:`, error.message);
      return { sent: false };
    }
    eventId = data.id;
  } else {
    const { data, error } = await supabaseAdmin
      .from("email_events")
      .insert({ preorder_id: preorderId, type, status: "pending" })
      .select("id")
      .single();
    if (error) {
      // Unique violation on (preorder_id, type) => a concurrent call claimed
      // this slot first. Let that call own the send.
      return { sent: false };
    }
    eventId = data.id;
  }

  try {
    const { to, subject, html } = await render();
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to,
      subject,
      html,
    });

    if (error) {
      await supabaseAdmin
        .from("email_events")
        .update({ status: "failed", error: error.message, updated_at: nowIso() })
        .eq("id", eventId);
      console.error(`sendEmailOnce(${type}): send failed:`, error.message);
      return { sent: false };
    }

    await supabaseAdmin
      .from("email_events")
      .update({ status: "sent", provider_id: data?.id ?? null, error: null, updated_at: nowIso() })
      .eq("id", eventId);
    return { sent: true };
  } catch (err) {
    const message = (err as Error).message;
    await supabaseAdmin
      .from("email_events")
      .update({ status: "failed", error: message, updated_at: nowIso() })
      .eq("id", eventId);
    console.error(`sendEmailOnce(${type}): send threw:`, message);
    return { sent: false };
  }
}
