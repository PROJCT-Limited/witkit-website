// FILE: app/configure/CartTransition.tsx
// -----------------------------------------------------------------------------
// The prototype's drawCart ported as a route transition rather than a
// blocking multi-second canvas state (Part 3.4): plays briefly between DONE
// and /review, reusing the same 3D model renderer, then navigates. Always
// skippable (a visible Skip control, and a hard timeout cap so a stalled
// animation can never actually block the order), and skipped entirely under
// prefers-reduced-motion — this component isn't even mounted in that case
// (see ConfiguratorClient), so there's no reduced-motion branch to get wrong.
// -----------------------------------------------------------------------------
"use client";

import { useEffect, useRef, useState } from "react";
import { ModelCanvas, type ModelCanvasHandle } from "./ModelCanvas";
import styles from "./cartTransition.module.css";

const AUTO_ADVANCE_MS = 1600;
const HARD_CAP_MS = 3000;

export function CartTransition({
  objectType,
  params,
  onDone,
}: {
  objectType: ModelCanvasHandle["objectType"];
  params: ModelCanvasHandle["params"];
  onDone: () => void;
}) {
  const stateRef = useRef<ModelCanvasHandle>({ objectType, params });
  const [phase, setPhase] = useState<"drop" | "settled">("drop");
  const firedRef = useRef(false);

  function advance() {
    if (firedRef.current) return;
    firedRef.current = true;
    onDone();
  }

  useEffect(() => {
    const settleTimer = setTimeout(() => setPhase("settled"), 500);
    const autoTimer = setTimeout(advance, AUTO_ADVANCE_MS);
    const hardCap = setTimeout(advance, HARD_CAP_MS);
    return () => {
      clearTimeout(settleTimer);
      clearTimeout(autoTimer);
      clearTimeout(hardCap);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.overlay} role="status" aria-live="polite">
      <button className={styles.skip} onClick={advance}>
        Skip
      </button>

      <div className={`${styles.model} ${phase === "settled" ? styles.modelSettled : ""}`}>
        <ModelCanvas stateRef={stateRef} />
      </div>

      <svg
        className={`${styles.basket} ${phase === "settled" ? styles.basketVisible : ""}`}
        width="72"
        height="60"
        viewBox="0 0 72 60"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M8 8 L20 8 L28 26 M28 26 L58 26 L50 52 L20 52 Z M20 26 L14 52 M40 26 L44 52 M30 26 L28 52"
          stroke="#181818"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>

      <p className={`${styles.message} ${phase === "settled" ? styles.messageVisible : ""}`}>
        The wit kit is on its way
      </p>
    </div>
  );
}
