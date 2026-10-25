import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, signSession } from "../auth/session-cookie";

const SECRET = "a-test-secret-that-is-at-least-32-characters-long";
const { middleware, isPublicPath } = await import("@/middleware");

const req = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost${path}`, {
    headers: cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {},
  });
const passesThrough = (res: Response) => res.headers.get("x-middleware-next") === "1";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("AUTH_REQUIRED", "true");
  vi.stubEnv("SESSION_SECRET", SECRET);
});

describe("sign-in middleware", () => {
  it("redirects unauthenticated page requests to /signin and remembers the destination", async () => {
    const res = await middleware(req("/dashboard?tab=1"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/signin");
    expect(location.searchParams.get("next")).toBe("/dashboard?tab=1");
  });

  it("returns 401 JSON (not a redirect) for unauthenticated API calls", async () => {
    const res = await middleware(req("/api/subjects"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Please sign in to continue." });
  });

  it("leaves public pages, auth endpoints and the intro flow open", async () => {
    for (const path of ["/", "/start", "/how-it-works", "/signin", "/api/auth/signin", "/api/auth/demo"]) {
      expect(passesThrough(await middleware(req(path))), path).toBe(true);
    }
    expect(isPublicPath("/onboarding")).toBe(false);
    expect(isPublicPath("/api/auth")).toBe(false);
  });

  it("lets a valid session through to protected pages and APIs", async () => {
    const token = await signSession("usr_1", SECRET);
    expect(passesThrough(await middleware(req("/dashboard", token)))).toBe(true);
    expect(passesThrough(await middleware(req("/api/questions", token)))).toBe(true);
  });

  it("blocks tampered, foreign-signed and expired cookies", async () => {
    const foreign = await signSession("usr_1", "another-secret-that-is-long-enough-123456789");
    const expired = await signSession("usr_1", SECRET, Date.now() - 10_000_000, 1);
    for (const bad of [foreign, expired, "usr_1.9999999999.AAAA"]) {
      expect((await middleware(req("/study", bad))).status).toBe(307);
    }
  });

  it("does nothing when auth is off (local development)", async () => {
    vi.stubEnv("AUTH_REQUIRED", "false");
    expect(passesThrough(await middleware(req("/dashboard")))).toBe(true);
  });
});
