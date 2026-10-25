/**
 * POST /api/auth/demo
 *
 * Signs the visitor into the shared demo account (the seeded `local-user`),
 * so reviewers can explore a populated app without creating an account. The
 * demo account is shared and writable, and the metrics script excludes it.
 * Disable with DEMO_ACCOUNT_ENABLED=false.
 */
import { authRequired } from "@/lib/auth/mode";
import {
  SESSION_COOKIE,
  getSessionSecret,
  sessionCookieOptions,
  signSession,
} from "@/lib/auth/session-cookie";
import { fail, handle, ok } from "@/lib/http";
import { DEFAULT_USER_ID, ensureDemoUser } from "@/lib/user";

export async function POST() {
  return handle(async () => {
    if (!authRequired()) return fail("Demo sign-in is not needed in local mode.", 404);
    if (process.env.DEMO_ACCOUNT_ENABLED === "false") return fail("The demo account is disabled.", 404);

    await ensureDemoUser();
    const res = ok({ demo: true });
    res.cookies.set(
      SESSION_COOKIE,
      await signSession(DEFAULT_USER_ID, getSessionSecret()),
      sessionCookieOptions(),
    );
    return res;
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
