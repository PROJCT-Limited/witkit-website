// FILE: lib/sanity/client.ts
// -----------------------------------------------------------------------------
// Not active in this repo yet — there's no Sanity project. isSanityConfigured()
// gates every fetch in lib/sanity/content.ts, so the app runs identically
// (falling back to the hardcoded copy already in place) whether or not these
// env vars are ever set. Once a project exists: set NEXT_PUBLIC_SANITY_PROJECT_ID
// and NEXT_PUBLIC_SANITY_DATASET (and SANITY_API_READ_TOKEN if the dataset
// is private) and content starts flowing with no code changes needed here.
// -----------------------------------------------------------------------------

import { createClient, type SanityClient } from "@sanity/client";

export function isSanityConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID && process.env.NEXT_PUBLIC_SANITY_DATASET);
}

let cachedClient: SanityClient | null = null;

export function getSanityClient(): SanityClient | null {
  if (!isSanityConfigured()) return null;
  if (cachedClient) return cachedClient;

  cachedClient = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
    apiVersion: "2026-01-01",
    token: process.env.SANITY_API_READ_TOKEN,
    useCdn: true,
  });
  return cachedClient;
}
