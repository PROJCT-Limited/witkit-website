// FILE: lib/supabase/admin.ts
// -----------------------------------------------------------------------------
// Server-ONLY Supabase client. Uses the SERVICE-ROLE key, which bypasses RLS —
// this is how the trusted, server-recomputed price gets written to the DB.
//
// NEVER import this into a client component or anything shipped to the browser.
// The service-role key is a full-access secret. Keep it in SUPABASE_SERVICE_ROLE_KEY
// (server env only — do NOT prefix it with NEXT_PUBLIC_).
// -----------------------------------------------------------------------------

import { createClient } from "@supabase/supabase-js";

if (typeof window !== "undefined") {
  throw new Error("lib/supabase/admin.ts must never be imported in the browser.");
}

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
