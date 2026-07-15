// FILE: proxy.ts
// -----------------------------------------------------------------------------
// Protects /admin and /api/admin with HTTP Basic Auth against ADMIN_USER /
// ADMIN_PASSWORD. Single-operator, pre-launch tool — plain string comparison
// is the standard tradeoff here (Edge runtime has no node:crypto timing-safe
// compare); upgrade to Supabase Auth + a role check before adding more admins.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

function unauthorized(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="wit kit admin"' },
  });
}

export function proxy(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return unauthorized();

  let decoded: string;
  try {
    decoded = atob(header.slice(6));
  } catch {
    return unauthorized();
  }

  const sep = decoded.indexOf(":");
  if (sep === -1) return unauthorized();

  const user = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);

  if (user !== process.env.ADMIN_USER || pass !== process.env.ADMIN_PASSWORD) {
    return unauthorized();
  }

  return NextResponse.next();
}
