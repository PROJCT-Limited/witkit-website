// FILE: sanity/schemaTypes/homePage.ts
// -----------------------------------------------------------------------------
// Singleton document for the home page's editorial content — the below-fold
// story sections, the lead-time blurb, and the hero fragment hover labels.
// NOT active yet: this repo has no Sanity project/Studio wired up (see
// lib/sanity/client.ts). Ready to drop into a Studio once one exists — the
// GROQ queries in lib/sanity/queries.ts already target this shape.
//
// Pricing rates, bounds, and order data never belong here — those live in
// Postgres param_schema, per the frontend brief's Sanity/Supabase split.
// -----------------------------------------------------------------------------

import { defineType, defineField, defineArrayMember } from "sanity";

export const homePage = defineType({
  name: "homePage",
  title: "Home page",
  type: "document",
  fields: [
    defineField({
      name: "storySections",
      title: "Story sections",
      description: "The below-the-fold sections on the home page (what wit kit is, made to order, how payment works).",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "storySection",
          fields: [
            defineField({ name: "title", type: "string", validation: (rule) => rule.required() }),
            defineField({ name: "body", type: "text", validation: (rule) => rule.required() }),
          ],
          preview: { select: { title: "title" } },
        }),
      ],
    }),
    defineField({
      name: "leadTimeNote",
      title: "Lead time note",
      description:
        "Editorial blurb about lead times, shown alongside the actual number (which stays in Postgres — products.lead_time_weeks).",
      type: "text",
    }),
    defineField({
      name: "fragmentLabels",
      title: "Hero fragment labels",
      description: "The hover/tap labels on the four hero fragments — title, number, description.",
      type: "array",
      validation: (rule) => rule.max(4),
      of: [
        defineArrayMember({
          type: "object",
          name: "fragmentLabel",
          fields: [
            defineField({ name: "title", type: "string", validation: (rule) => rule.required() }),
            defineField({ name: "num", title: "Number", type: "string", validation: (rule) => rule.required() }),
            defineField({ name: "desc", title: "Description", type: "string", validation: (rule) => rule.required() }),
          ],
          preview: { select: { title: "title", subtitle: "num" } },
        }),
      ],
    }),
  ],
  preview: {
    prepare: () => ({ title: "Home page content" }),
  },
});
