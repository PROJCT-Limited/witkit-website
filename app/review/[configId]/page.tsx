// FILE: app/review/[configId]/page.tsx
// -----------------------------------------------------------------------------
// GET /review/:configId — confirmation step for a bespoke, non-returnable
// object before the customer enters payment details. Queries Supabase
// directly (same pattern as app/checkout/page.tsx) rather than round-tripping
// through GET /api/configurations/:id from a server component.
//
// NOTE: the frontend brief said "Confirm -> /checkout?configId=...", but the
// existing checkout page (app/checkout/page.tsx) reads `configurationId`, not
// `configId` — using the brief's literal param name would silently 404 the
// confirm button. Using the real param name instead.
// -----------------------------------------------------------------------------

import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { objectTypeFromSlug } from "@/lib/client/paramMap";
import { Button } from "@/components/Button";
import { ReviewModel } from "./ReviewModel";
import styles from "./review.module.css";

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(
    cents / 100
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

const PARAM_LABELS: Record<string, string> = {
  width: "Width",
  depth: "Depth",
  height: "Height",
  legWidth: "Leg width",
  topThickness: "Top thickness",
};

const BREAKDOWN_LABELS: Record<string, string> = {
  base_cents: "Base",
  height_cents: "Height",
  surface_cents: "Surface",
};

export default async function ReviewPage({ params }: { params: Promise<{ configId: string }> }) {
  const { configId } = await params;

  const { data: configuration } = await supabaseAdmin
    .from("configurations")
    .select("id, params, price_cents, currency, price_breakdown, products(slug, name, lead_time_weeks)")
    .eq("id", configId)
    .maybeSingle();

  if (!configuration) notFound();

  const product = Array.isArray(configuration.products) ? configuration.products[0] : configuration.products;
  const objectType = product ? objectTypeFromSlug(product.slug) : null;
  if (!product || !objectType) notFound();

  const apiParams = configuration.params as Record<string, number>;
  const breakdown = configuration.price_breakdown as Record<string, number>;
  const deadline = process.env.CANCELLATION_DEADLINE;

  return (
    <div className={styles.page}>
      <div className={styles.modelArea}>
        <ReviewModel objectType={objectType} apiParams={apiParams} />
      </div>

      <div className={styles.details}>
        <h1 className={styles.title}>{product.name}</h1>

        <ul className={styles.specList}>
          {Object.entries(apiParams).map(([key, value]) => (
            <li key={key}>
              <span>{PARAM_LABELS[key] ?? key}</span>
              <span>{value} cm</span>
            </li>
          ))}
        </ul>

        <div className={styles.priceBox}>
          <div className={styles.priceTotal}>
            <span>Total</span>
            <span>{formatMoney(configuration.price_cents, configuration.currency)}</span>
          </div>
          <ul className={styles.breakdownList}>
            {Object.entries(breakdown).map(([key, cents]) => (
              <li key={key}>
                <span>{BREAKDOWN_LABELS[key] ?? key}</span>
                <span>{formatMoney(cents, configuration.currency)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.copy}>
          <p>
            Made to order — nothing is built until it's paid for.
            {product.lead_time_weeks
              ? ` Once production starts, plan on about ${product.lead_time_weeks} week${product.lead_time_weeks === 1 ? "" : "s"} to delivery.`
              : " Lead time is confirmed once production starts."}
          </p>
          <p>Ships worldwide.</p>
          <p>
            Pay a 20% deposit now. The remaining balance is charged automatically
            {deadline ? ` on ${formatDate(deadline)}, when production starts` : " when production starts"} —
            you can cancel for a full refund of your deposit any time before then.
          </p>
        </div>

        <div className={styles.actions}>
          <Button variant="primary" href={`/checkout?configurationId=${configuration.id}`}>
            Confirm and continue
          </Button>
        </div>
      </div>
    </div>
  );
}
