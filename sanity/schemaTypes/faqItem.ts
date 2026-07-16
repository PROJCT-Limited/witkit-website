// FILE: sanity/schemaTypes/faqItem.ts
// -----------------------------------------------------------------------------
// One FAQ entry. A document type (not an array field on homePage) because
// FAQ items are an open-ended, independently-orderable collection — unlike
// the fixed 4 hero fragment labels, editors will add/remove/reorder these
// freely over time.
// -----------------------------------------------------------------------------

import { defineType, defineField } from "sanity";

export const faqItem = defineType({
  name: "faqItem",
  title: "FAQ item",
  type: "document",
  fields: [
    defineField({ name: "question", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "answer", type: "text", validation: (rule) => rule.required() }),
    defineField({
      name: "order",
      title: "Display order",
      type: "number",
      description: "Lower numbers show first.",
      validation: (rule) => rule.required(),
    }),
  ],
  orderings: [
    {
      title: "Display order",
      name: "orderAsc",
      by: [{ field: "order", direction: "asc" }],
    },
  ],
  preview: {
    select: { title: "question" },
  },
});
