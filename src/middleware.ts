import { NextRequest, NextResponse } from "next/server";

// `/api/vehicles/transfer/ingest` is server-to-server (sister portal) and is
// guarded by a shared secret in the handler, so it must bypass session auth.
// The manifest and app icons must stay reachable without a session, otherwise
// "Add to Home Screen" installs with no name or icon.
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/guide", "/driver-dvir", "/api/dvir/public", "/api/vehicles/transfer/ingest", "/manifest.webmanifest", "/icon", "/apple-icon", "/sw.js"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has("fleet_session");

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!hasSession && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (hasSession && pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
