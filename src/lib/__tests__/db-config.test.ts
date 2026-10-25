import { describe, expect, it } from "vitest";
import {
  MissingDatabaseConfigError,
  assertDurableDatabase,
  isHostedProduction,
} from "../db/config";

describe("assertDurableDatabase", () => {
  it("throws in production without a Turso URL", () => {
    expect(() => assertDurableDatabase({ NODE_ENV: "production" })).toThrow(MissingDatabaseConfigError);
  });

  it("throws on hosted platforms even when NODE_ENV is unset", () => {
    for (const marker of [{ RENDER: "true" }, { RAILWAY_ENVIRONMENT: "production" }, { VERCEL: "1" }]) {
      expect(() => assertDurableDatabase(marker)).toThrow(MissingDatabaseConfigError);
    }
  });

  it("explains how to fix it", () => {
    expect(() => assertDurableDatabase({ NODE_ENV: "production" })).toThrow(/TURSO_DATABASE_URL/);
  });

  it("passes when Turso is configured", () => {
    expect(() =>
      assertDurableDatabase({ NODE_ENV: "production", TURSO_DATABASE_URL: "libsql://x.turso.io" }),
    ).not.toThrow();
  });

  it("allows an explicit local-file override", () => {
    expect(() => assertDurableDatabase({ NODE_ENV: "production", ALLOW_LOCAL_DB: "true" })).not.toThrow();
  });

  it("never blocks local development or tests", () => {
    expect(() => assertDurableDatabase({ NODE_ENV: "development" })).not.toThrow();
    expect(() => assertDurableDatabase({ NODE_ENV: "test" })).not.toThrow();
    expect(() => assertDurableDatabase({})).not.toThrow();
  });

  it("does not block `next build`, which has no runtime secrets", () => {
    expect(() =>
      assertDurableDatabase({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" }),
    ).not.toThrow();
  });

  it("detects hosted production", () => {
    expect(isHostedProduction({ NODE_ENV: "production" })).toBe(true);
    expect(isHostedProduction({ NODE_ENV: "development" })).toBe(false);
  });
});
