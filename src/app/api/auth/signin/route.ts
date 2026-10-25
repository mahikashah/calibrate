/**
 * POST /api/auth/signin  { email }
 *
 * Passwordless sign-in for the closed pilot. Finds or creates the student's
 * user by (lower-cased) email and sets a signed, httpOnly session cookie.
 *
 * NOTE: there is no email verification. Anyone who knows a student's email can
 * sign in as them, which is acceptable for a small closed pilot but not for a
 * public launch (add magic links or OAuth before that).
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { authRequired } from "@/lib/auth/mode";
import {
  SESSION_COOKIE,
  getSessionSecret,
  sessionCookieOptions,
  signSession,
} from "@/lib/auth/session-cookie";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { fail, handle, ok } from "@/lib/http";
import { newId } from "@/lib/ids";

const SignIn = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
});

export async function POST(req: Request) {
  return handle(async () => {
    if (!authRequired()) {
      return fail("Sign-in is disabled in local single-user mode.", 404);
    }
    const { email } = SignIn.parse(await req.json());

    let user = await db.select().from(users).where(eq(users.email, email)).get();
    let isNew = false;
    if (!user) {
      const row = {
        id: newId("usr"),
        name: email.split("@")[0].slice(0, 40) || "Student",
        email,
        createdAt: new Date().toISOString(),
      };
      try {
        await db.insert(users).values(row).run();
        user = row;
        isNew = true;
      } catch (err) {
        // A concurrent request may have created the same email first.
        user = await db.select().from(users).where(eq(users.email, email)).get();
        if (!user) throw err;
      }
    }

    const res = ok({ email: user.email, isNew });
    res.cookies.set(
      SESSION_COOKIE,
      await signSession(user.id, getSessionSecret()),
      sessionCookieOptions(),
    );
    return res;
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
