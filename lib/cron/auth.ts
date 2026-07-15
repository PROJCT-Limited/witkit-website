// FILE: lib/cron/auth.ts
// -----------------------------------------------------------------------------
// Shared auth check for every /api/cron/* route. Accepts exactly the header
// Vercel's Cron scheduler sends (`Authorization: Bearer $CRON_SECRET` on a GET
// request) plus a `?secret=` query param for manual curl/browser testing.
// -----------------------------------------------------------------------------

import { NextRequest } from "next/server";

export function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("secret") === secret;
}
