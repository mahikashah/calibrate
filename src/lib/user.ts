import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { authRequired } from "./auth/mode";
import { UnauthorizedError } from "./auth/errors";
import { SESSION_COOKIE, getSessionSecret, verifySession } from "./auth/session-cookie";
import { db } from "./db";
import { users } from "./db/schema";
import { newId } from "./ids";

/**
 * The owner row used for local development, tests, and the shared demo
 * account. In production (AUTH_REQUIRED) students each get their own user via
 * email sign-in and this id is only reachable through the demo entry point.
 */
export const DEFAULT_USER_ID = "local-user";

async function ensureLocalUser() {
  let user = await db.select().from(users).where(eq(users.id, DEFAULT_USER_ID)).get();
  if (!user) {
    user = {
      id: DEFAULT_USER_ID,
      name: "You",
      email: null,
      createdAt: new Date().toISOString(),
    };
    await db.insert(users).values(user).run();
  }
  return user;
}

/** Make sure the shared demo/local user exists (used by the demo sign-in route). */
export const ensureDemoUser = ensureLocalUser;

/**
 * Resolve the signed-in student.
 *  - Auth off (local dev, tests): always the single local user.
 *  - Auth on (production): the user named by a valid signed session cookie,
 *    otherwise UnauthorizedError (mapped to HTTP 401 by `handle`).
 */
export async function getCurrentUser() {
  if (!authRequired()) return ensureLocalUser();

  const token = cookies().get(SESSION_COOKIE)?.value;
  const userId = await verifySession(token, getSessionSecret());
  if (!userId) throw new UnauthorizedError();

  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function currentUserId(): Promise<string> {
  return (await getCurrentUser()).id;
}

export { newId, UnauthorizedError };
