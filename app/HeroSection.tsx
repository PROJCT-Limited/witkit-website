// FILE: app/HeroSection.tsx
// -----------------------------------------------------------------------------
// Ported from the prototype's drawHero + supporting functions. Per Part 1 of
// the frontend brief: canvas draws only what only canvas can do (face, brain,
// fragments, the scroll-driven reveal); the wordmark, CTA, and fragment
// labels are real DOM, positioned/faded from canvas-computed values.
//
// Continuous values (word fade, CTA fade) are applied by mutating DOM refs
// directly inside the p5 draw loop rather than via React state — at 60fps,
// setState here would mean 60 re-renders/sec for a value that's just an
// opacity. Fragment hover/tap state changes rarely, so that DOES go through
// React state, and is deliberately captured as a one-time position snapshot
// on interaction-start rather than continuously re-tracked (a label that
// jitters while you're reading it would be worse UX than one that's pinned).
//
// Scroll is intercepted (preventDefault) only while the reveal sequence is
// incomplete AND the page hasn't been scrolled away from the top — once the
// sequence finishes, wheel/touch events fall through to normal page scroll.
// The prototype's original handler always returned false, permanently
// trapping the scroll; that's fixed here per Part 3.1.
//
// prefers-reduced-motion: no scroll listener is attached at all, the
// sequence starts at its end state, and fragments don't drift.
// -----------------------------------------------------------------------------
"use client";

import { useEffect, useRef, useState } from "react";
import type p5Types from "p5";
import { Button } from "@/components/Button";
import { BRAIN_PTS, LABELS, type FragmentLabel } from "./hero-data";
import styles from "./hero.module.css";

const FACE_SRC = "/images/Asset 1@4x.png";
const BRAIN_SRC = "/images/Asset 2.svg";
const FRAG_SRC = [
  "/images/DV424R.tif@2x.png",
  "/images/PIHOQl.tif@2x.png",
  "/images/DV424R.tif@2x.png",
  "/images/PIHOQl.tif@2x.png",
  "/images/PIHOQl.tif@2x.png",
];

const LIP = 0.78;
const TOPM = 0.03;
const BRAIN_W = 0.62;
const BRAIN_RATIO = 1.2121;
const FRAG_SIZE = 90;

interface OpenLabel {
  label: FragmentLabel;
  x: number;
  y: number;
}

export function HeroSection({ labels = LABELS }: { labels?: FragmentLabel[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wordmarkRef = useRef<HTMLHeadingElement>(null);
  const ctaWrapRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const [openLabel, setOpenLabel] = useState<OpenLabel | null>(null);
  // Snapshot once: the p5 effect below intentionally mounts only on first
  // render ([] deps, to avoid tearing down the WEBGL canvas), so it captures
  // whatever `labels` was at that point. Fine here — this prop comes from a
  // server fetch and isn't expected to change during the component's life.
  const labelsRef = useRef(labels);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let p5Instance: p5Types | null = null;
    let cancelled = false;
    const reducedMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Lock page scroll SYNCHRONOUSLY, before p5 even starts loading. Doing
    // this only inside the async p5 setup left a race: if the browser
    // scrolled the page at all before p5 finished its dynamic import (which
    // can take a few hundred ms), the reveal sequence's own "don't trap
    // scroll" guard (`window.scrollY > 4`) would see that pre-existing
    // scroll and permanently refuse to engage — the wheel intercept would
    // never fire, and the reveal sequence would silently never play. Locking
    // here, before any scroll can occur, closes that race entirely.
    // Lock both <html> and <body>: in standards mode the browser picks
    // documentElement as the actual scrolling box, so overflow:hidden on
    // body alone doesn't reliably stop the page from scrolling.
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    function lockScroll() {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }
    function unlockScroll() {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    }
    if (!reducedMotion) lockScroll();

    import("p5").then(({ default: P5 }) => {
      if (cancelled || !container) return;

      const sketch = (p: p5Types) => {
        let face = new window.Image();
        let faceReady = false;
        let brain = new window.Image();
        let brainReady = false;
        const fragImgs = FRAG_SRC.map((s) => {
          const im = new window.Image();
          im.src = s;
          return im;
        });

        let prog = reducedMotion ? 1 : 0;
        let target = reducedMotion ? 1 : 0;
        let bx = 0, by = 0, bw = 0, bh = 0;
        let poly: Array<{ x: number; y: number }> = [];

        interface Frag {
          img: number;
          x: number;
          y: number;
          vx: number;
          vy: number;
          rot: number;
          vr: number;
          s: number;
        }
        let frags: Frag[] = [];
        let dragging = -1;
        const dragOff = { x: 0, y: 0 };
        let ctaRect: { x: number; y: number; w: number; h: number } | null = null;
        let lastHoveredIndex = -1;

        function faceBox() {
          const visibleH = p.height * 0.92;
          const ratio = faceReady && face.height ? face.width / face.height : 0.7;
          const fullW = (visibleH / LIP) * ratio;
          return { dx: p.width / 2 - fullW / 2, dy: p.height * TOPM, dW: fullW, dH: visibleH };
        }

        function layout() {
          const f = faceBox();
          bw = f.dW * BRAIN_W;
          bh = bw / BRAIN_RATIO;
          bx = p.width / 2;
          by = f.dy + f.dH * 0.3;
          const dx = bx - bw / 2, dy = by - bh / 2;
          poly = BRAIN_PTS.map(([px, py]) => ({ x: dx + px * bw, y: dy + py * bh }));
        }

        function newFrag(i: number): Frag {
          return {
            img: i,
            x: bx + p.random(-70, 70),
            y: by + p.random(-70, 70),
            vx: p.random(-0.5, 0.5),
            vy: p.random(-0.5, 0.5),
            rot: p.random(p.TWO_PI),
            vr: p.random(-0.008, 0.008),
            s: FRAG_SIZE * p.random(0.8, 1.2),
          };
        }

        function fragSize(f: Frag) {
          const im = fragImgs[f.img];
          const w = f.s;
          const h = im && im.naturalWidth ? f.s * (im.naturalHeight / im.naturalWidth) : f.s;
          return { w, h };
        }

        function inBrain(x: number, y: number) {
          if (poly.length < 3) {
            const nx = (x - bx) / (bw / 2), ny = (y - by) / (bh / 2);
            return nx * nx + ny * ny <= 0.9;
          }
          let c = false;
          for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const a = poly[i], b = poly[j];
            if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
          }
          return c;
        }

        function pullInside(f: Frag) {
          let it = 0;
          while (!inBrain(f.x, f.y) && it < 12) {
            f.x = p.lerp(f.x, bx, 0.12);
            f.y = p.lerp(f.y, by, 0.12);
            it++;
          }
        }

        function loadBrain() {
          fetch(encodeURI(BRAIN_SRC))
            .then((r) => r.text())
            .then((txt) => {
              // Fixed from the prototype's `fill="##000000"` typo (invalid
              // color, double hash) — uses the design system's --ink token.
              const patched = txt.replace(/<svg/i, '<svg width="563" height="465" fill="#222220" ');
              const url = URL.createObjectURL(new Blob([patched], { type: "image/svg+xml" }));
              brain.onload = () => {
                brainReady = true;
              };
              brain.src = url;
            })
            .catch(() => {
              brain.onload = () => {
                brainReady = true;
              };
              brain.src = BRAIN_SRC;
            });
        }

        p.setup = () => {
          p.createCanvas(container.clientWidth, container.clientHeight);
          face.onload = () => {
            faceReady = true;
            layout();
          };
          face.src = FACE_SRC;
          loadBrain();
          layout();
          for (let i = 0; i < fragImgs.length; i++) frags.push(newFrag(i));
        };

        const ctx2d = () => p.drawingContext as CanvasRenderingContext2D;

        p.draw = () => {
          p.background(244, 243, 240);

          prog += (target - prog) * (reducedMotion ? 1 : 0.08);

          // Release the scroll lock once the reveal is effectively done —
          // this is the only place the lock is lifted, so however target
          // reached 1 (wheel, touch, reduced-motion skip), normal page
          // scroll resumes exactly once, never staying trapped.
          if (!reducedMotion && prog > 0.995 && document.body.style.overflow === "hidden") {
            unlockScroll();
          }

          const appear = p.constrain((prog - 0.08) / 0.14, 0, 1);
          const gone = p.constrain(1 - (prog - 0.45) / 0.18, 0, 1);
          const faceA = appear * gone;
          const brainA = p.constrain((prog - 0.42) / 0.22, 0, 1);
          const fragA = p.constrain((prog - 0.55) / 0.22, 0, 1);
          const ctaA = p.constrain((prog - 0.72) / 0.12, 0, 1);

          const wordFade = p.lerp(1, 0.35, brainA);
          if (wordmarkRef.current) wordmarkRef.current.style.opacity = String(wordFade);

          // brain
          if (brainReady && brainA > 0.01) {
            ctx2d().globalAlpha = brainA;
            ctx2d().drawImage(brain, bx - bw / 2, by - bh / 2, bw, bh);
            ctx2d().globalAlpha = 1;
          }

          // fragments
          if (fragA > 0.01) {
            if (!reducedMotion) {
              for (let i = 0; i < frags.length; i++) {
                if (i === dragging) continue;
                const f = frags[i];
                f.x += f.vx;
                f.y += f.vy;
                f.rot += f.vr;
                f.vx += p.random(-0.04, 0.04);
                f.vy += p.random(-0.04, 0.04);
                if (!inBrain(f.x, f.y)) {
                  f.vx += (bx - f.x) * 0.005;
                  f.vy += (by - f.y) * 0.005;
                  f.vx *= 0.9;
                  f.vy *= 0.9;
                  pullInside(f);
                }
                const sp = p.mag(f.vx, f.vy);
                if (sp > 0.9) {
                  f.vx *= 0.9 / sp;
                  f.vy *= 0.9 / sp;
                }
              }
            }
            for (const f of frags) {
              const im = fragImgs[f.img];
              const sz = fragSize(f);
              p.push();
              p.translate(f.x, f.y);
              p.rotate(f.rot);
              if (im && im.naturalWidth) {
                ctx2d().globalAlpha = fragA;
                ctx2d().drawImage(im, -sz.w / 2, -sz.h / 2, sz.w, sz.h);
                ctx2d().globalAlpha = 1;
              } else {
                p.rectMode(p.CENTER);
                p.noStroke();
                p.fill(205, 205, 201, 180 * fragA);
                p.rect(0, 0, sz.w, sz.h, 6);
              }
              p.pop();
            }
          }

          // face
          if (faceReady && faceA > 0.01) {
            const b = faceBox();
            ctx2d().globalAlpha = faceA;
            ctx2d().drawImage(
              face,
              0,
              0,
              face.width,
              face.height * LIP,
              b.dx,
              b.dy,
              b.dW,
              b.dH
            );
            ctx2d().globalAlpha = 1;
          }

          // fragment hover (desktop only — touch uses tap, handled in touchStarted)
          if (fragA > 0.5 && dragging < 0 && !("ontouchstart" in window)) {
            const i = fragUnder(p.mouseX, p.mouseY);
            if (i !== lastHoveredIndex) {
              lastHoveredIndex = i;
              if (i >= 0) {
                const f = frags[i];
                setOpenLabel({ label: labelsRef.current[i % labelsRef.current.length], x: f.x, y: f.y });
              } else {
                setOpenLabel(null);
              }
            }
          }

          // CTA overlay fade/position (real DOM element; canvas only computes geometry)
          if (ctaA > 0.01) {
            const w = 250, h = 48;
            const x = p.width / 2 - w / 2;
            const y = p.height * 0.6 + (1 - ctaA) * 16;
            ctaRect = { x, y, w, h };
          } else {
            ctaRect = null;
          }
          if (ctaWrapRef.current) {
            ctaWrapRef.current.style.opacity = String(ctaA);
            ctaWrapRef.current.style.pointerEvents = ctaA > 0.5 ? "auto" : "none";
            if (ctaRect) {
              ctaWrapRef.current.style.left = `${ctaRect.x}px`;
              ctaWrapRef.current.style.top = `${ctaRect.y}px`;
            }
          }

          // hint text
          if (hintRef.current) {
            if (prog < 0.06) {
              hintRef.current.textContent = "scroll";
              hintRef.current.style.opacity = "1";
            } else if (fragA > 0.6 && !ctaRect) {
              hintRef.current.textContent = "hover the fragments";
              hintRef.current.style.opacity = "1";
            } else {
              hintRef.current.style.opacity = "0";
            }
          }
        };

        function fragUnder(mx: number, my: number) {
          for (let i = frags.length - 1; i >= 0; i--) {
            const sz = fragSize(frags[i]);
            const r = (Math.max(sz.w, sz.h) / 2) * 1.05;
            if (p.dist(mx, my, frags[i].x, frags[i].y) < r) return i;
          }
          return -1;
        }

        // p5 v2 dropped the separate touchStarted/touchMoved/touchEnded
        // lifecycle — touch input is unified into Pointer Events, so it
        // drives mousePressed/mouseDragged/mouseReleased too (with
        // event.pointerType === "touch"). Wheel-driven reveal has no touch
        // equivalent, so a vertical swipe has to drive it here instead. Once
        // fragments become interactive late in the sequence, a touch there
        // opens/closes its label instead of continuing to drive the reveal.
        let touchDriving = false;
        let touchLastY = 0;

        p.mousePressed = (event?: MouseEvent) => {
          const isTouch = (event as PointerEvent | undefined)?.pointerType === "touch";
          const fragA = p.constrain((prog - 0.55) / 0.22, 0, 1);

          if (isTouch) {
            if (fragA >= 0.5) {
              const i = fragUnder(p.mouseX, p.mouseY);
              if (i >= 0) {
                const f = frags[i];
                setOpenLabel((prev) =>
                  prev && prev.label === labelsRef.current[i % labelsRef.current.length]
                    ? null
                    : { label: labelsRef.current[i % labelsRef.current.length], x: f.x, y: f.y }
                );
              } else {
                setOpenLabel(null);
              }
              return false;
            }
            if (!reducedMotion && target < 1) {
              touchDriving = true;
              touchLastY = p.mouseY;
              return false;
            }
            return; // sequence already done — let the page scroll normally
          }

          if (fragA < 0.5) return;
          const i = fragUnder(p.mouseX, p.mouseY);
          if (i >= 0) {
            dragging = i;
            dragOff.x = p.mouseX - frags[i].x;
            dragOff.y = p.mouseY - frags[i].y;
          }
        };
        p.mouseDragged = (event?: MouseEvent) => {
          if ((event as PointerEvent | undefined)?.pointerType === "touch") {
            if (!touchDriving) return;
            if (target >= 1) {
              touchDriving = false;
              return;
            }
            const dy = touchLastY - p.mouseY; // swiping up advances the reveal, like scrolling down
            // Kept close to the desktop wheel multiplier (0.0008) — both dy
            // and deltaY are in comparable device-pixel units, so a much
            // higher touch multiplier here made a single swipe blow straight
            // through the whole reveal instead of pacing it like scrolling does.
            target = p.constrain(target + dy * 0.001, 0, 1);
            touchLastY = p.mouseY;
            return false;
          }

          if (dragging < 0) return false;
          const f = frags[dragging];
          f.x = p.mouseX - dragOff.x;
          f.y = p.mouseY - dragOff.y;
          if (!reducedMotion) pullInside(f);
          f.vx = p.mouseX - p.pmouseX;
          f.vy = p.mouseY - p.pmouseY;
          return false;
        };
        p.mouseReleased = (event?: MouseEvent) => {
          if ((event as PointerEvent | undefined)?.pointerType === "touch") {
            touchDriving = false;
            return;
          }
          dragging = -1;
        };

        // Drive the reveal while incomplete; once finished, return nothing
        // (undefined) so normal page scroll happens instead of trapping it —
        // the prototype's handler always returned false, permanently
        // capturing the wheel. Fixed per Part 3.1. (No window.scrollY guard
        // needed here: the body-overflow lock above already makes page
        // scroll impossible until the sequence completes, so there's no
        // race between "has the page scrolled" and "has p5 loaded yet".)
        p.mouseWheel = (e: WheelEvent) => {
          if (reducedMotion || target >= 1) return;
          target = p.constrain(target + e.deltaY * 0.0008, 0, 1);
          return false;
        };

        p.windowResized = () => {
          p.resizeCanvas(container.clientWidth, container.clientHeight);
          layout();
        };
      };

      p5Instance = new P5(sketch, container);

      let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
      const observer = new ResizeObserver(() => {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          (p5Instance as unknown as { windowResized?: () => void }).windowResized?.();
        }, 150);
      });
      observer.observe(container);

      (container as HTMLDivElement & { __resizeObserver?: ResizeObserver }).__resizeObserver = observer;
    });

    return () => {
      cancelled = true;
      unlockScroll();
      (container as HTMLDivElement & { __resizeObserver?: ResizeObserver }).__resizeObserver?.disconnect();
      p5Instance?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className={styles.hero}>
      <a href="#configurator-skip" className={styles.skipLink}>
        Skip intro — go straight to the configurator
      </a>

      <div ref={containerRef} className={styles.canvasContainer} aria-hidden="true" />

      <h1 ref={wordmarkRef} className={styles.wordmark}>
        WIT KIT
      </h1>

      <p ref={hintRef} className={styles.hint} aria-hidden="true" />

      <div ref={ctaWrapRef} className={styles.ctaWrap} id="configurator-skip">
        <Button variant="secondary" href="/configure">
          Enter wit's mind
        </Button>
      </div>

      {openLabel && (
        <div
          className={styles.fragmentLabel}
          style={{ left: openLabel.x + 24, top: openLabel.y - 30 }}
          onClick={() => setOpenLabel(null)}
        >
          <div className={styles.fragmentLabelHead}>
            <span>{openLabel.label.title}</span>
            <span className={styles.fragmentLabelNum}>{openLabel.label.num}</span>
          </div>
          <div className={styles.fragmentLabelDesc}>{openLabel.label.desc}</div>
        </div>
      )}

      {/* Screen-reader-only text alternative for the decorative canvas. */}
      <p className={styles.srOnly}>
        wit kit — a small-batch object maker. Design your own table, stool, or shelf.
      </p>
    </section>
  );
}
