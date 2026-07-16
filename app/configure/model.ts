// FILE: app/configure/model.ts
// -----------------------------------------------------------------------------
// Ported 1:1 from the p5 prototype's drawTable/drawStool/drawShelf/beam. These
// already operated on a passed-in graphics target (`g.push()`, `g.box()`,
// etc.), so porting to p5 instance mode needed zero syntax changes — only
// typing. Params are in PROTOTYPE space (S/W/D/H/legH/t/topT); see
// lib/client/paramMap.ts for the translation from API space.
// -----------------------------------------------------------------------------

import type p5 from "p5";

export type PrototypeParams = Record<string, number>;

function beam(g: p5, x: number, y: number, z: number, w: number, h: number, d: number) {
  g.push();
  g.translate(x, y, z);
  g.box(w, h, d);
  g.pop();
}

export function drawTable(g: p5, p: PrototypeParams) {
  const W = p.W, D = p.D, H = p.legH, t = p.t, tt = p.topT;
  beam(g, 0, -H / 2 - tt / 2, 0, W, tt, D);
  const ry = -H / 2 + t / 2;
  beam(g, 0, ry, D / 2 - t / 2, W, t, t);
  beam(g, 0, ry, -(D / 2 - t / 2), W, t, t);
  beam(g, W / 2 - t / 2, ry, 0, t, t, D);
  beam(g, -(W / 2 - t / 2), ry, 0, t, t, D);
  const lx = W / 2 - t / 2, lz = D / 2 - t / 2;
  beam(g, lx, 0, lz, t, H, t);
  beam(g, -lx, 0, lz, t, H, t);
  beam(g, lx, 0, -lz, t, H, t);
  beam(g, -lx, 0, -lz, t, H, t);
}

export function drawStool(g: p5, p: PrototypeParams) {
  const S = p.S, H = p.legH, t = p.t, tt = p.topT;
  beam(g, 0, -H / 2 - tt / 2, 0, S, tt, S);
  const lx = S / 2 - t / 2;
  beam(g, lx, 0, lx, t, H, t);
  beam(g, -lx, 0, lx, t, H, t);
  beam(g, lx, 0, -lx, t, H, t);
  beam(g, -lx, 0, -lx, t, H, t);
}

export function drawShelf(g: p5, p: PrototypeParams) {
  const W = p.W, H = p.H, D = p.D, t = p.t;
  const lx = W / 2 - t / 2, lz = D / 2 - t / 2;
  beam(g, lx, 0, lz, t, H, t);
  beam(g, -lx, 0, lz, t, H, t);
  beam(g, lx, 0, -lz, t, H, t);
  beam(g, -lx, 0, -lz, t, H, t);
  for (const y of [-H / 2 + t / 2, 0, H / 2 - t / 2]) {
    beam(g, 0, y, 0, W, t, D);
  }
}

export const DRAW_FNS: Record<"table" | "stool" | "shelf", (g: p5, p: PrototypeParams) => void> = {
  table: drawTable,
  stool: drawStool,
  shelf: drawShelf,
};
