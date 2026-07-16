// FILE: app/fonts.ts
// -----------------------------------------------------------------------------
// Self-hosted via next/font/local (reads the OTF directly at build time, no
// woff2 conversion needed — Next optimizes/subsets it automatically). Two
// roles only, per the design system: Black for the wordmark, Regular for
// everything else in the UI.
//
// LICENCE: OT2049 is bundled in this repo but its licence hasn't been
// confirmed to permit web embedding — flagged for Valeria, don't treat this
// as cleared for production until she confirms (see Part 8 report).
// -----------------------------------------------------------------------------

import localFont from "next/font/local";

export const fontDisplay = localFont({
  src: "../public/fonts/OT2049-Black.otf",
  variable: "--font-display",
  display: "swap",
});

export const fontMono = localFont({
  src: "../public/fonts/OT2049-Regular.otf",
  variable: "--font-mono",
  display: "swap",
});
