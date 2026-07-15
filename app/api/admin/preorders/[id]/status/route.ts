// FILE: app/api/admin/preorders/[id]/status/route.ts
// -----------------------------------------------------------------------------
// POST /api/admin/preorders/:id/status
// Manual ops-state transitions only: deposit_paid -> in_production -> fulfilled.
// Payment-driving transitions (deposit_paid, confirmed, cancelled, refunded)
// stay exclusively the webhook's / cancel route's job — never settable here.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ALLOWED_TARGETS = new Set(["in_production", "fulfilled"]);

const ALLOWED_FROM: Record<string, string[]> = {
  in_production: ["deposit_paid", "confirmed"],
  fulfilled: ["in_production"],
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: ["Invalid JSON body."] }, { status: 400 });
  }

  const target = body?.status;
  if (typeof target !== "string" || !ALLOWED_TARGETS.has(target)) {
    return NextResponse.json(
      { errors: [`\`status\` must be one of: ${[...ALLOWED_TARGETS].join(", ")}.`] },
      { status: 400 }
    );
  }

  const { data: preorder, error: fetchError } = await supabaseAdmin
    .from("preorders")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !preorder) {
    return NextResponse.json({ errors: ["Preorder not found."] }, { status: 404 });
  }

  if (!ALLOWED_FROM[target].includes(preorder.status)) {
    return NextResponse.json(
      {
        errors: [
          `Cannot set status "${target}" from "${preorder.status}". Allowed from: ${ALLOWED_FROM[target].join(", ")}.`,
        ],
      },
      { status: 409 }
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("preorders")
    .update({ status: target, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ errors: ["Could not update status."] }, { status: 500 });
  }

  return NextResponse.json({ status: target });
}
