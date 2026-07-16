// FILE: app/configure/CartTransition.tsx
// -----------------------------------------------------------------------------
// The prototype's drawCart/renderCart/drawBasket, ported faithfully — same
// left→center→right flight path with the drop-in bounce, the same
// hand-drawn basket line art, the same "THE WIT KIT IS ON IT'S WAY!" message
// timing. Runs as a route transition between DONE and /review rather than a
// blocking page state (Part 3.4): always skippable, hard-capped so a stalled
// render can never actually block the order, and never mounted at all under
// prefers-reduced-motion (see ConfiguratorClient).
//
// Everything draws on ONE WEBGL canvas rather than the prototype's separate
// 2D main canvas + composited WEBGL sub-buffer (`createGraphics(...,WEBGL)`):
// in p5 v2.x, camera methods like ortho() are only registered on the main
// p5 instance's prototype, not on Graphics buffers, so a second WEBGL buffer
// can't set its own orthographic projection without reaching into private
// (`_renderer`) internals. Drawing model + basket + text on the single main
// canvas — the same approach ModelCanvas.tsx already uses — sidesteps that
// entirely; screen-space coordinates are just translated into WEBGL's
// centered coordinate system instead of top-left-origin.
// -----------------------------------------------------------------------------
"use client";

import { useEffect, useRef } from "react";
import type p5Types from "p5";
import { DRAW_FNS, type PrototypeParams } from "./model";
import styles from "./cartTransition.module.css";

const HARD_CAP_MS = 4500;

export function CartTransition({
  objectType,
  params,
  onDone,
}: {
  objectType: "table" | "stool" | "shelf";
  params: PrototypeParams;
  onDone: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const firedRef = useRef(false);

  function advance() {
    if (firedRef.current) return;
    firedRef.current = true;
    onDone();
  }

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let p5Instance: p5Types | null = null;
    let cancelled = false;
    const hardCap = setTimeout(advance, HARD_CAP_MS);

    import("p5").then(({ default: P5 }) => {
      if (cancelled || !container) return;

      const sketch = (p: p5Types) => {
        let cartT = 0;

        p.setup = () => {
          p.createCanvas(container.clientWidth, container.clientHeight, p.WEBGL);
        };

        // Basket line art, ported 1:1 from the prototype's drawBasket — just
        // called with coordinates already translated to WEBGL's centered
        // origin by the caller, instead of p5 2D mode's top-left origin.
        function drawBasket(cx: number, cy: number, k: number) {
          p.push();
          p.translate(cx, cy);
          p.scale(k);
          p.stroke(20);
          p.strokeWeight(5);
          p.noFill();
          p.strokeJoin(p.ROUND);
          p.line(-58, -30, -42, -30);
          p.line(-42, -30, -30, 16);
          p.beginShape();
          p.vertex(-30, -16);
          p.vertex(46, -16);
          p.vertex(36, 16);
          p.vertex(-22, 16);
          p.endShape(p.CLOSE);
          p.strokeWeight(2.5);
          for (let gx = -18; gx < 44; gx += 14) p.line(gx, -16, gx - 3, 16);
          p.line(-26, -2, 42, -2);
          p.strokeWeight(5);
          p.line(-22, 16, 40, 16);
          p.noStroke();
          p.fill(20);
          p.circle(-12, 30, 14);
          p.circle(28, 30, 14);
          p.pop();
        }

        p.draw = () => {
          p.background(244, 243, 240);

          cartT += 0.006;
          const t = cartT;

          // Screen-space (top-left origin) timeline, identical to the
          // prototype — converted to WEBGL's centered origin only at the
          // point of drawing.
          const leftX = p.width * 0.18, centreX = p.width * 0.5, rightX = p.width * 1.25, baseY = p.height * 0.52;
          let cx: number;
          if (t < 0.25) cx = leftX;
          else if (t < 0.55) cx = p.lerp(leftX, centreX, (t - 0.25) / 0.3);
          else if (t < 0.7) cx = centreX;
          else cx = p.lerp(centreX, rightX, (t - 0.7) / 0.3);
          const drop = t < 0.25 ? p.lerp(-260, 0, t / 0.25) : 0;

          const originX = -p.width / 2;
          const originY = -p.height / 2;

          // Flying model
          p.push();
          p.translate(originX + cx, originY + baseY - 90 + drop, 0);
          p.scale(2.6);
          p.rotateX(-0.5);
          p.rotateY(0.7);
          p.ambientLight(170);
          p.directionalLight(255, 255, 255, 0.35, 0.7, -0.5);
          p.stroke(110);
          p.strokeWeight(0.6);
          p.fill(190);
          DRAW_FNS[objectType](p, params);
          p.pop();

          // Basket
          drawBasket(originX + cx, originY + baseY, 1.6);

          if (t > 0.45) {
            p.push();
            p.noStroke();
            p.fill(24);
            p.textSize(Math.min(p.width * 0.03, 26));
            p.textAlign(p.CENTER, p.CENTER);
            p.text("THE WIT KIT IS ON IT'S WAY!", originX + p.width / 2, originY + baseY + 120);
            p.pop();
          }

          if (t >= 1) advance();
        };

        p.windowResized = () => {
          p.resizeCanvas(container.clientWidth, container.clientHeight);
        };
      };

      p5Instance = new P5(sketch, container);
    });

    return () => {
      cancelled = true;
      clearTimeout(hardCap);
      p5Instance?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.overlay} role="status" aria-live="polite">
      <button className={styles.skip} onClick={advance}>
        Skip
      </button>
      <div ref={containerRef} className={styles.canvasHost} />
    </div>
  );
}
