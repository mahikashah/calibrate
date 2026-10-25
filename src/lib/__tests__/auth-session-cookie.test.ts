import { describe, expect, it } from "vitest";
import { authRequired } from "../auth/mode";
import { safeNextPath } from "../auth/safe-next";
import {
  getSessionSecret,
  sessionCookieOptions,
  signSession,
  verifySession,
} from "../auth/session-cookie";

const SECRET = "a-test-secret-that-is-at-least-32-characters-long";
const NOW = Date.UTC(2026, 9, 26, 12, 0, 0);

describe("signed session cookie", () => {
  it("round-trips a user id", async () => {
    const token = await signSession("usr_1234-abcd", SECRET, NOW);
    expect(await verifySession(token, SECRET, NOW + 1000)).toBe("usr_1234-abcd");
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signSession("usr_1", SECRET, NOW);
    expect(await verifySession(token, SECRET + "x", NOW)).toBeNull();
  });

  it("rejects a tampered user id (cannot switch into another student's account)", async () => {
    const token = await signSession("usr_victim", SECRET, NOW);
    const [, exp, sig] = token.split(".");
    expect(await verifySession(`usr_attacker.${exp}.${sig}`, SECRET, NOW)).toBeNull();
  });

  it("rejects a tampered expiry", async () => {
    const token = await signSession("usr_1", SECRET, NOW, 60);
    const [id, exp, sig] = token.split(".");
    expect(await verifySession(`${id}.${Number(exp) + 99999}.${sig}`, SECRET, NOW)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await signSession("usr_1", SECRET, NOW, 60);
    expect(await verifySession(token, SECRET, NOW + 61_000)).toBeNull();
  });

  it("rejects malformed values without throwing", async () => {
    for (const bad of ["", "abc", "a.b", "a.b.c.d", "usr.123.not*base64", undefined, null]) {
      expect(await verifySession(bad as string | undefined, SECRET, NOW)).toBeNull();
    }
  });

  it("refuses to sign an id containing the separator", async () => {
    await expect(signSession("usr.evil", SECRET, NOW)).rejects.toThrow();
  });
});

describe("session secret and cookie options", () => {
  it("requires a long secret in production", () => {
    expect(() => getSessionSecret({ NODE_ENV: "production" })).toThrow(/SESSION_SECRET/);
    expect(() => getSessionSecret({ NODE_ENV: "production", SESSION_SECRET: "short" })).toThrow();
    expect(getSessionSecret({ NODE_ENV: "production", SESSION_SECRET: SECRET })).toBe(SECRET);
  });

  it("falls back to a dev secret outside production", () => {
    expect(getSessionSecret({ NODE_ENV: "development" }).length).toBeGreaterThanOrEqual(32);
  });

  it("uses httpOnly, lax, secure-in-production cookies", () => {
    const prod = sessionCookieOptions({ NODE_ENV: "production" });
    expect(prod).toMatchObject({ httpOnly: true, sameSite: "lax", secure: true, path: "/" });
    expect(sessionCookieOptions({ NODE_ENV: "development" }).secure).toBe(false);
  });
});

describe("authRequired", () => {
  it("defaults to required in production only", () => {
    expect(authRequired({ NODE_ENV: "production" })).toBe(true);
    expect(authRequired({ NODE_ENV: "development" })).toBe(false);
    expect(authRequired({ NODE_ENV: "test" })).toBe(false);
  });

  it("honours an explicit AUTH_REQUIRED override", () => {
    expect(authRequired({ NODE_ENV: "development", AUTH_REQUIRED: "true" })).toBe(true);
    expect(authRequired({ NODE_ENV: "production", AUTH_REQUIRED: "false" })).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("allows same-site relative paths", () => {
    expect(safeNextPath("/onboarding")).toBe("/onboarding");
    expect(safeNextPath("/subjects?x=1")).toBe("/subjects?x=1");
  });

  it("blocks open redirects", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "evil.com", "", null, undefined]) {
      expect(safeNextPath(bad as string | null | undefined)).toBeNull();
    }
  });
});
