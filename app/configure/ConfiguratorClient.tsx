// FILE: app/configure/ConfiguratorClient.tsx
// -----------------------------------------------------------------------------
// The builder. Slider state lives in API space (built straight from
// GET /api/products/[slug]'s param_schema — bounds are never hardcoded here,
// per Part 0.3). toPrototypeParams() translates only at the render boundary,
// for the p5 model. The stool's width/depth are collapsed into one "Seat
// width" slider that sets both (Part 0.2) rather than exposing two sliders
// that would have to be kept in sync by hand.
//
// Price and the structural-ceiling check both reuse lib/pricing.ts directly
// (computePrice/validateConfig) rather than reimplementing the formula
// client-side — same code the server recomputes with, so this can't drift.
// -----------------------------------------------------------------------------
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { computePrice, validateConfig, type ParamSchema } from "@/lib/pricing";
import { toPrototypeParams, OBJECT_TYPE_SLUGS, type ObjectType } from "@/lib/client/paramMap";
import { Button } from "@/components/Button";
import { ModelCanvas, type ModelCanvasHandle } from "./ModelCanvas";
import { CartTransition } from "./CartTransition";
import styles from "./configure.module.css";

const OBJECT_LABELS: Record<ObjectType, string> = { table: "Table", stool: "Stool", shelf: "Shelf" };

const PARAM_LABELS: Record<string, string> = {
  width: "Width",
  depth: "Depth",
  height: "Height",
  legWidth: "Leg width",
  topThickness: "Top thickness",
};

// The stool's seat is square — one slider ("Seat width") drives both width
// and depth, so "depth" never gets its own slider. legWidth/topThickness
// are hidden from the UI entirely (per Valeria's request) — they still get
// set to a sensible default via defaultParams() and are still sent to the
// API, just not user-adjustable.
const HIDDEN_PARAMS = new Set(["legWidth", "topThickness"]);

function visibleParamKeys(objectType: ObjectType, schema: ParamSchema): string[] {
  const keys = Object.keys(schema.params).filter((k) => !HIDDEN_PARAMS.has(k));
  if (objectType !== "stool") return keys;
  return keys.filter((k) => k !== "depth");
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function defaultParams(schema: ParamSchema): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, rule] of Object.entries(schema.params)) {
    out[key] = Math.round(((rule.min + rule.max) / 2) / rule.step) * rule.step;
  }
  return out;
}

export function ConfiguratorClient({ initialType }: { initialType: ObjectType }) {
  const router = useRouter();
  const [objectType, setObjectType] = useState<ObjectType>(initialType);
  const [schema, setSchema] = useState<ParamSchema | null>(null);
  const [apiParams, setApiParams] = useState<Record<string, number>>({});
  const [schemaError, setSchemaError] = useState<string | null>(null);
  // Which object `schema`/`apiParams` actually belong to. Needed because
  // React runs the schema-fetch effect and the model-sync effect (below)
  // back-to-back off the SAME render: when objectType changes, model-sync
  // still executes once against that render's stale schema/apiParams
  // (the fetch effect's setState calls only take effect on the NEXT
  // render) — for the stool that's a leftover non-square width/depth pair
  // from whatever object was previously selected, and toPrototypeParams
  // throws. Gating on loadedForType === objectType, updated only once fetch
  // + params are set together, closes that window regardless of render timing.
  const [loadedForType, setLoadedForType] = useState<ObjectType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string[] | null>(null);
  const [cartTransition, setCartTransition] = useState<{
    url: string;
    objectType: ModelCanvasHandle["objectType"];
    params: ModelCanvasHandle["params"];
  } | null>(null);

  const modelStateRef = useRef<ModelCanvasHandle>({ objectType: "table", params: {} });

  useEffect(() => {
    let cancelled = false;
    setSchema(null);
    setSchemaError(null);
    setApiParams({});

    fetch(`/api/products/${OBJECT_TYPE_SLUGS[objectType]}`)
      .then((res) => {
        if (!res.ok) throw new Error("Could not load this object's schema.");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const nextSchema = data.param_schema as ParamSchema;
        setSchema(nextSchema);
        setApiParams(defaultParams(nextSchema));
        // objectType here is this effect's own closure — correct for
        // whichever fetch this was, even if the user has since switched
        // again (the `cancelled` guard above already handles that case).
        setLoadedForType(objectType);
      })
      .catch((err) => {
        if (!cancelled) setSchemaError((err as Error).message);
      });

    return () => {
      cancelled = true;
    };
  }, [objectType]);

  // Keep the live p5 render in sync without re-mounting the WEBGL canvas.
  // loadedForType !== objectType is the important guard here — see its
  // declaration for why the more obvious `!schema` check alone isn't enough.
  useEffect(() => {
    if (!schema || loadedForType !== objectType || Object.keys(apiParams).length === 0) return;
    modelStateRef.current = {
      objectType,
      params: toPrototypeParams(objectType, apiParams),
    };
  }, [objectType, apiParams, schema, loadedForType]);

  const validation = useMemo(() => {
    if (!schema || Object.keys(apiParams).length === 0) return null;
    return validateConfig(schema, apiParams);
  }, [schema, apiParams]);

  const price = useMemo(() => {
    if (!schema || Object.keys(apiParams).length === 0) return null;
    return computePrice(schema, apiParams);
  }, [schema, apiParams]);

  function updateParam(key: string, value: number) {
    if (key === "width" && objectType === "stool") {
      setApiParams((prev) => ({ ...prev, width: value, depth: value }));
      return;
    }
    setApiParams((prev) => ({ ...prev, [key]: value }));
  }

  async function handleDone() {
    if (!validation?.valid) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/configurations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productSlug: OBJECT_TYPE_SLUGS[objectType], params: apiParams }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.errors ?? ["Something went wrong. Please try again."]);
        setSubmitting(false);
        return;
      }

      const reviewUrl = `/review/${data.id}`;
      const reducedMotion =
        typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reducedMotion) {
        // Skipped entirely, not just shortened — the transition component
        // never mounts, matching Part 3.4's "skipped entirely" requirement.
        router.push(reviewUrl);
        return;
      }

      setCartTransition({
        url: reviewUrl,
        objectType,
        params: toPrototypeParams(objectType, apiParams),
      });
    } catch {
      setSubmitError(["Network error. Please try again."]);
      setSubmitting(false);
    }
  }

  const structuralWarning = validation?.errors.find((e) => e.startsWith("Top is too large"));
  const otherErrors = validation?.errors.filter((e) => e !== structuralWarning) ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.modelArea}>
        <ModelCanvas stateRef={modelStateRef} />
        <p className={styles.modelHint}>drag to rotate · scroll or pinch to zoom</p>
      </div>

      <div className={styles.controls}>
        <div className={styles.objectSwitcher} role="tablist" aria-label="Object type">
          {(Object.keys(OBJECT_LABELS) as ObjectType[]).map((key) => (
            <button
              key={key}
              role="tab"
              aria-selected={objectType === key}
              className={`${styles.objectCard} ${objectType === key ? styles.objectCardActive : ""}`}
              onClick={() => setObjectType(key)}
            >
              {OBJECT_LABELS[key]}
            </button>
          ))}
        </div>

        {schemaError && <p className={styles.error}>{schemaError}</p>}

        {schema && (
          <>
            <div className={styles.priceRow}>
              <span className={styles.priceLabel}>Estimated price</span>
              <span className={styles.price}>{price ? formatMoney(price.price_cents) : "—"}</span>
            </div>
            <p className={styles.hint}>Made to order · deposit 20% now, balance before production starts.</p>

            {visibleParamKeys(objectType, schema).map((key) => {
              const rule = schema.params[key];
              const value = apiParams[key] ?? rule.min;
              const label = objectType === "stool" && key === "width" ? "Seat width" : PARAM_LABELS[key] ?? key;
              return (
                <label key={key} className={styles.sliderRow}>
                  <span className={styles.sliderLabel}>{label}</span>
                  <input
                    type="range"
                    min={rule.min}
                    max={rule.max}
                    step={rule.step}
                    value={value}
                    onChange={(e) => updateParam(key, Number(e.target.value))}
                    className={styles.slider}
                  />
                  <span className={styles.sliderValue}>{value} cm</span>
                </label>
              );
            })}

            {structuralWarning && <p className={styles.warning}>{structuralWarning}</p>}
            {otherErrors.length > 0 && (
              <ul className={styles.error}>
                {otherErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            {submitError && (
              <ul className={styles.error}>
                {submitError.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}

            <div className={styles.doneRow}>
              <Button
                variant="primary"
                disabled={!validation?.valid}
                loading={submitting}
                loadingText="Saving…"
                onClick={handleDone}
              >
                Done
              </Button>
            </div>
          </>
        )}
      </div>

      {cartTransition && (
        <CartTransition
          objectType={cartTransition.objectType}
          params={cartTransition.params}
          onDone={() => router.push(cartTransition.url)}
        />
      )}
    </div>
  );
}
