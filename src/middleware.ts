/**
 * Gate the app behind sign-in when AUTH_REQUIRED (default in production).
 *
 * Public: the landing/intro pages, the sign-in page, auth endpoints, and
 * static assets. Everything else needs a valid signed session cookie; pages
 * redirect to /signin and API calls get a 401 JSON error.
 *
 * This is a convenience layer. The real data boundary is still the per-user
 * `userId` filter in every API route (see src/lib/user.ts).
 */
import { NextResponse, type NextRequest } from "next/server";
import { authRequired } from "@/lib/auth/mode";
import { SESSION_COOKIE, getSessionSecret, verifySession } from "@/lib/auth/session-cookie";

const PUBLIC_PAGES = new Set(["/", "/start", "/how-it-works", "/signin"]);

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PAGES.has(pathname) || pathname.startsWith("/api/auth/");
}

export async function middleware(req: NextRequest) {
  if (!authRequired()) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySession(token, getSessionSecret())) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/signin";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals and static image assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};
