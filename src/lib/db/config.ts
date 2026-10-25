/**
 * Database configuration guard.
 *
 * Hosted platforms (Render free, Vercel, most container hosts) give the app an
 * ephemeral filesystem. If TURSO_DATABASE_URL is missing there, the app would
 * quietly fall back to a local SQLite file and then lose every student's data
 * on the next restart or deploy. Refuse to start instead.
 *
 * Kept free of Node-only imports so it is easy to unit test and safe to share
 * between the app, the migrate script, and the seed script.
 */

export type EnvLike = Record<string, string | undefined>;

export class MissingDatabaseConfigError extends Error {
  constructor() {
    super(
      "TURSO_DATABASE_URL is not set. Hosted deployments must use a durable database " +
        "(create one with `turso db create calibrate`, then set TURSO_DATABASE_URL and " +
        "TURSO_AUTH_TOKEN). To deliberately use a local SQLite file in production-mode " +
        "(for example a single-machine demo with a persistent disk), set ALLOW_LOCAL_DB=true.",
    );
    this.name = "MissingDatabaseConfigError";
  }
}

/** True when the process looks like a real deployment rather than local dev or tests. */
export function isHostedProduction(env: EnvLike = process.env): boolean {
  return (
    env.NODE_ENV === "production" ||
    Boolean(env.RENDER) ||
    Boolean(env.RAILWAY_ENVIRONMENT) ||
    Boolean(env.VERCEL)
  );
}

/**
 * Throws MissingDatabaseConfigError when a hosted deployment would use a local
 * SQLite file. Safe to call from module scope: it is skipped during
 * `next build`, which imports route modules without runtime secrets.
 */
export function assertDurableDatabase(env: EnvLike = process.env): void {
  if (env.NEXT_PHASE === "phase-production-build") return;
  if (env.TURSO_DATABASE_URL) return;
  if (env.ALLOW_LOCAL_DB === "true") return;
  if (!isHostedProduction(env)) return;
  throw new MissingDatabaseConfigError();
}
