// FILE: app/checkout/stripeAppearance.ts
// -----------------------------------------------------------------------------
// Stripe Elements `appearance` config matching the paper/ink design system
// (Part 3.5: "Style via Elements appearance options to match paper/ink").
// Shared between the deposit payment step and the SCA complete-payment page
// so both look like the same product. Hex values are the exact same colors
// as the CSS custom properties in app/globals.css — Stripe's iframed fields
// can't read CSS variables directly, so they're restated here literally.
// -----------------------------------------------------------------------------

import type { Appearance } from "@stripe/stripe-js";

export const stripeAppearance: Appearance = {
  theme: "flat",
  variables: {
    colorPrimary: "#181818", // --ink-ui
    colorBackground: "#F4F3F0", // --paper
    colorText: "#181818", // --ink-ui
    colorDanger: "#B3261E",
    fontFamily: "ui-monospace, Menlo, monospace",
    fontSizeBase: "14px",
    borderRadius: "0px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": {
      border: "1.4px solid #181818",
      boxShadow: "none",
      padding: "10px 12px",
    },
    ".Input:focus": {
      border: "1.4px solid #181818",
      boxShadow: "none",
      outline: "2px solid #181818",
      outlineOffset: "1px",
    },
    ".Label": {
      fontSize: "12px",
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      color: "#696863", // --grey
      marginBottom: "6px",
    },
    ".Tab": {
      border: "1.4px solid #181818",
      borderRadius: "0px",
    },
    ".Tab--selected": {
      backgroundColor: "#181818",
      color: "#F4F3F0",
    },
  },
};
