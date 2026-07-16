// FILE: lib/sanity/content.ts
// -----------------------------------------------------------------------------
// Fetch helpers used by the pages. Every function returns null (never throws)
// when Sanity isn't configured or a fetch fails, so call sites can do
// `data ?? FALLBACK_COPY` and the page renders identically either way — this
// is what makes the CMS wiring safe to ship before a project exists.
// -----------------------------------------------------------------------------

import { getSanityClient } from "./client";
import { HOME_PAGE_QUERY, FAQ_QUERY } from "./queries";
import type { FragmentLabel } from "@/app/hero-data";

export interface StorySection {
  title: string;
  body: string;
}

export interface HomePageContent {
  storySections: StorySection[] | null;
  leadTimeNote: string | null;
  fragmentLabels: FragmentLabel[] | null;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export async function getHomePageContent(): Promise<HomePageContent | null> {
  const client = getSanityClient();
  if (!client) return null;
  try {
    const data = await client.fetch<HomePageContent | null>(HOME_PAGE_QUERY, {}, { next: { revalidate: 300 } });
    return data;
  } catch (err) {
    console.error("getHomePageContent: Sanity fetch failed:", (err as Error).message);
    return null;
  }
}

export async function getFaqItems(): Promise<FaqItem[] | null> {
  const client = getSanityClient();
  if (!client) return null;
  try {
    const data = await client.fetch<FaqItem[]>(FAQ_QUERY, {}, { next: { revalidate: 300 } });
    return data.length ? data : null;
  } catch (err) {
    console.error("getFaqItems: Sanity fetch failed:", (err as Error).message);
    return null;
  }
}
