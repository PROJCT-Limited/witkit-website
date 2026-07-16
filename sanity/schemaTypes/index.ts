// FILE: sanity/schemaTypes/index.ts
// -----------------------------------------------------------------------------
// Import this into a Studio's sanity.config.ts (schema.types) once a Sanity
// project exists — see the "Sanity setup" note in the repo README/report for
// how to activate this.
// -----------------------------------------------------------------------------

import { homePage } from "./homePage";
import { faqItem } from "./faqItem";

export const schemaTypes = [homePage, faqItem];
