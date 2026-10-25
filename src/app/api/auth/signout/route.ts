import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session-cookie";
import { handle, ok } from "@/lib/http";

export async function POST() {
  return handle(async () => {
    const res = ok({ signedOut: true });
    res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
    return res;
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
