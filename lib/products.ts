// FILE: lib/products.ts
// -----------------------------------------------------------------------------
// Loads a single ACTIVE product (and its param_schema) by slug. Returns null if
// it doesn't exist or is inactive — callers turn that into a 404.
// -----------------------------------------------------------------------------

import { supabaseAdmin } from "./supabase/admin";
import type { ProductRow } from "./configurations";

export async function getProductBySlug(slug: string): Promise<ProductRow | null> {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, slug, active, param_schema")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    console.error("product lookup failed:", error.message);
    return null;
  }
  return (data as ProductRow | null) ?? null;
}
