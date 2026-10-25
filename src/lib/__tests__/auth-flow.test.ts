/**
 * End-to-end checks for pilot sign-in using the real route handlers, real
 * session cookies, and an in-memory database:
 *
 *   - email sign-in creates / reuses one user per (case-insensitive) email
 *   - the issued cookie authenticates later requests
 *   - one student can never read or modify another student's data
 *   - requests without a valid cookie get 401 when auth is required
 *   - local single-user mode (auth off) is unchanged
 */
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as DbSchema from "../db/schema";
import { SESSION_COOKIE, signSession } from "../auth/session-cookie";

let sharedDb: BetterSQLite3Database<typeof DbSchema>;
const SECRET = "a-test-secret-that-is-at-least-32-characters-long";
let cookieJar: Record<string, string> = {};

vi.mock("@/lib/db", async () => {
  const BetterSqlite3 = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const schema = await import("../db/schema");
  const sqlite = new BetterSqlite3(":memory:");
  sqlite.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE, created_at TEXT NOT NULL);
    CREATE TABLE subjects (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL, created_at TEXT NOT NULL);
  `);
  sharedDb = drizzle(sqlite, { schema });
  return { db: sharedDb };
});

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => (cookieJar[name] ? { name, value: cookieJar[name] } : undefined),
  }),
}));

const { POST: signIn } = await import("@/app/api/auth/signin/route");
const { POST: demo } = await import("@/app/api/auth/demo/route");
const { POST: signOut } = await import("@/app/api/auth/signout/route");
const { GET: me } = await import("@/app/api/auth/me/route");
const { GET: listSubjects, POST: createSubject } = await import("@/app/api/subjects/route");
const { users, subjects } = await import("../db/schema");

const json = (body: unknown) =>
  new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

/** Sign in through the real route and return the issued cookie value. */
async function signInAs(email: string) {
  const res = await signIn(json({ email }));
  expect(res.status).toBe(200);
  const cookie = (res as unknown as { cookies: { get(n: string): { value: string } | undefined } }).cookies.get(
    SESSION_COOKIE,
  );
  expect(cookie?.value).toBeTruthy();
  return { cookie: cookie!.value, body: (await res.json()) as { email: string; isNew: boolean } };
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("AUTH_REQUIRED", "true");
  vi.stubEnv("SESSION_SECRET", SECRET);
  cookieJar = {};
  sharedDb.delete(subjects).run();
  sharedDb.delete(users).run();
});

describe("email sign-in", () => {
  it("creates a user and sets an httpOnly signed cookie", async () => {
    const res = await signIn(json({ email: "Student@School.edu " }));
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE}=`);
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
    const body = (await res.json()) as { email: string; isNew: boolean };
    expect(body).toEqual({ email: "student@school.edu", isNew: true });
    expect(sharedDb.select().from(users).all()).toHaveLength(1);
  });

  it("reuses the same user for the same email, ignoring case", async () => {
    const first = await signInAs("a@school.edu");
    const second = await signInAs("A@SCHOOL.EDU");
    expect(first.body.isNew).toBe(true);
    expect(second.body.isNew).toBe(false);
    expect(sharedDb.select().from(users).all()).toHaveLength(1);
  });

  it("rejects invalid emails", async () => {
    for (const email of ["", "not-an-email", "a@", "@b.com"]) {
      const res = await signIn(json({ email }));
      expect(res.status).toBe(422);
    }
    expect(sharedDb.select().from(users).all()).toHaveLength(0);
  });

  it("is disabled in local single-user mode", async () => {
    vi.stubEnv("AUTH_REQUIRED", "false");
    const res = await signIn(json({ email: "a@school.edu" }));
    expect(res.status).toBe(404);
  });
});

describe("per-student data isolation (the pilot blocker)", () => {
  it("returns 401 without a session cookie", async () => {
    const res = await listSubjects();
    expect(res.status).toBe(401);
    const post = await createSubject(json({ name: "Bio" }));
    expect(post.status).toBe(401);
  });

  it("rejects a forged or foreign-signed cookie", async () => {
    cookieJar[SESSION_COOKIE] = await signSession("usr_x", "some-other-secret-that-is-long-enough-123456");
    expect((await listSubjects()).status).toBe(401);
    cookieJar[SESSION_COOKIE] = "usr_x.9999999999.AAAA";
    expect((await listSubjects()).status).toBe(401);
  });

  it("rejects a validly signed cookie for a user that does not exist", async () => {
    cookieJar[SESSION_COOKIE] = await signSession("usr_ghost", SECRET);
    expect((await listSubjects()).status).toBe(401);
  });

  it("keeps each student's subjects private", async () => {
    const a = await signInAs("a@school.edu");
    const b = await signInAs("b@school.edu");

    cookieJar[SESSION_COOKIE] = a.cookie;
    expect((await createSubject(json({ name: "Neuroscience" }))).status).toBe(201);
    expect((await createSubject(json({ name: "Chemistry" }))).status).toBe(201);

    cookieJar[SESSION_COOKIE] = b.cookie;
    expect((await createSubject(json({ name: "History" }))).status).toBe(201);

    const bList = (await (await listSubjects()).json()) as { name: string }[];
    expect(bList.map((s) => s.name)).toEqual(["History"]);

    cookieJar[SESSION_COOKIE] = a.cookie;
    const aList = (await (await listSubjects()).json()) as { name: string }[];
    expect(aList.map((s) => s.name).sort()).toEqual(["Chemistry", "Neuroscience"]);
  });
});

describe("demo account, me, and sign-out", () => {
  it("signs a visitor into the shared demo user", async () => {
    const res = await demo();
    expect(res.status).toBe(200);
    const cookie = (res as unknown as { cookies: { get(n: string): { value: string } | undefined } }).cookies.get(
      SESSION_COOKIE,
    );
    cookieJar[SESSION_COOKIE] = cookie!.value;
    const who = (await (await me()).json()) as { authenticated: boolean; demo: boolean };
    expect(who).toMatchObject({ authenticated: true, demo: true });
  });

  it("can be disabled", async () => {
    vi.stubEnv("DEMO_ACCOUNT_ENABLED", "false");
    expect((await demo()).status).toBe(404);
  });

  it("reports the signed-in email, and unauthenticated visitors", async () => {
    expect(await (await me()).json()).toMatchObject({ authenticated: false, mode: "account" });
    const a = await signInAs("a@school.edu");
    cookieJar[SESSION_COOKIE] = a.cookie;
    expect(await (await me()).json()).toMatchObject({ authenticated: true, email: "a@school.edu", demo: false });
  });

  it("clears the cookie on sign-out", async () => {
    const res = await signOut();
    const setCookie = (res.headers.get("set-cookie") ?? "").toLowerCase();
    expect(setCookie).toContain(`${SESSION_COOKIE}=;`);
    expect(setCookie).toMatch(/max-age=0|expires=/);
  });
});

describe("local single-user mode", () => {
  it("still works with no cookie when auth is off", async () => {
    vi.stubEnv("AUTH_REQUIRED", "false");
    expect((await createSubject(json({ name: "Local" }))).status).toBe(201);
    const list = (await (await listSubjects()).json()) as { name: string }[];
    expect(list.map((s) => s.name)).toEqual(["Local"]);
    expect(await (await me()).json()).toMatchObject({ authenticated: false, mode: "local" });
  });
});
