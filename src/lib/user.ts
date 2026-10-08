import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "./db/schema";
import { newId } from "./ids";

/**
 * Calibrate is single-user and local. We keep exactly one owner row and always
 * resolve to it. Introducing real auth later means swapping this one function.
 */
export const DEFAULT_USER_ID = "local-user";

export async function getCurrentUser() {
  let user = await db.select().from(users).where(eq(users.id, DEFAULT_USER_ID)).get();
  if (!user) {
    user = { id: DEFAULT_USER_ID, name: "You", createdAt: new Date().toISOString() };
    await db.insert(users).values(user).run();
  }
  return user;
}

export async function currentUserId(): Promise<string> {
  return (await getCurrentUser()).id;
}

export { newId };
