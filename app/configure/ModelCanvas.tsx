// FILE: app/configure/ModelCanvas.tsx
// -----------------------------------------------------------------------------
// Mounts the WEBGL p5 instance for the 3D object preview. p5 owns none of the
// app's state — it reads current params/object-type from a ref on every
// frame, so a slider drag never tears down and rebuilds the WEBGL context
// (Part 1: "p5 never owns routing or state React needs"). Orbit via
// mouse-drag or one-finger touch-drag; zoom via scroll or two-finger pinch.
// Resize is ResizeObserver-driven and debounced (Part 5 performance note —
// the prototype's windowResized recreated a full buffer on every event).
// -----------------------------------------------------------------------------
"use client";

import { useEffect, useRef } from "react";
import type p5Types from "p5";
import { DRAW_FNS, type PrototypeParams } from "./model";

export interface ModelCanvasHandle {
  objectType: "table" | "stool" | "shelf";
  params: PrototypeParams;
}

export function ModelCanvas({ stateRef }: { stateRef: React.RefObject<ModelCanvasHandle> }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let p5Instance: p5Types | null = null;
    let cancelled = false;

    // p5's WEBGL renderer touches the DOM/canvas API, which doesn't exist
    // during SSR — load it only once mounted in the browser.
    import("p5").then(({ default: P5 }) => {
      if (cancelled || !container) return;

      const sketch = (p: p5Types) => {
        let rotX = -0.5;
        let rotY = 0.7;
        let zoom = 1;
        let dragging = false;
        let pinchStartDist = 0;
        let pinchStartZoom = 1;

        function size() {
          return { w: container.clientWidth, h: container.clientHeight };
        }

        p.setup = () => {
          const { w, h } = size();
          p.createCanvas(w, h, p.WEBGL);
        };

        p.draw = () => {
          p.clear();
          p.push();
          const { w, h } = size();
          p.ortho(-w / 2, w / 2, -h / 2, h / 2, -3000, 3000);
          p.scale(3.2 * zoom);
          p.rotateX(rotX);
          p.rotateY(rotY);
          p.ambientLight(170);
          p.directionalLight(255, 255, 255, 0.35, 0.7, -0.5);
          p.stroke(110);
          p.strokeWeight(0.6 / zoom);
          p.fill(190);
          const state = stateRef.current;
          DRAW_FNS[state.objectType](p, state.params);
          p.pop();
        };

        // p5 v2 dropped the separate touchStarted/touchMoved/touchEnded
        // lifecycle — touch input is unified into Pointer Events, so it
        // drives mousePressed/mouseDragged/mouseReleased instead (with
        // event.pointerType === "touch"). Single-finger rotate already works
        // through the plain mouse path below since Pointer Events cover it;
        // only the 2-finger pinch needs its own branch, keyed off
        // p.touches.length, which p5 keeps populated regardless of which
        // lifecycle callback fires.
        p.mousePressed = (event?: MouseEvent) => {
          if ((event as PointerEvent | undefined)?.pointerType === "touch" && p.touches.length >= 2) {
            dragging = false;
            const [a, b] = p.touches as unknown as Array<{ x: number; y: number }>;
            pinchStartDist = p.dist(a.x, a.y, b.x, b.y);
            pinchStartZoom = zoom;
            return;
          }
          if (p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height) {
            dragging = true;
          }
        };
        p.mouseDragged = (event?: MouseEvent) => {
          if ((event as PointerEvent | undefined)?.pointerType === "touch" && p.touches.length >= 2) {
            const [a, b] = p.touches as unknown as Array<{ x: number; y: number }>;
            const d = p.dist(a.x, a.y, b.x, b.y);
            if (pinchStartDist > 0) {
              zoom = p.constrain(pinchStartZoom * (d / pinchStartDist), 0.4, 3);
            }
            return;
          }
          if (!dragging) return;
          rotY += (p.mouseX - p.pmouseX) * 0.01;
          rotX += (p.mouseY - p.pmouseY) * 0.01;
        };
        p.mouseReleased = (event?: MouseEvent) => {
          if ((event as PointerEvent | undefined)?.pointerType === "touch") {
            pinchStartDist = 0;
            if (p.touches.length === 0) dragging = false;
            return;
          }
          dragging = false;
        };
        p.mouseWheel = (e: WheelEvent) => {
          zoom = p.constrain(zoom - e.deltaY * 0.0008, 0.4, 3);
          return false;
        };
      };

      p5Instance = new P5(sketch, container);

      let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
      const observer = new ResizeObserver(() => {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          if (!p5Instance || !container) return;
          p5Instance.resizeCanvas(container.clientWidth, container.clientHeight);
        }, 150);
      });
      observer.observe(container);

      (container as HTMLDivElement & { __resizeObserver?: ResizeObserver }).__resizeObserver = observer;
    });

    return () => {
      cancelled = true;
      const obs = (container as HTMLDivElement & { __resizeObserver?: ResizeObserver }).__resizeObserver;
      obs?.disconnect();
      p5Instance?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="3D preview of your configured object — drag to rotate, scroll or pinch to zoom"
      style={{ width: "100%", height: "100%", touchAction: "none" }}
    />
  );
}
