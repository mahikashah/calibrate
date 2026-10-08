import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

/**
 * A single shared database connection for the whole app.
 *
 * - Production: set TURSO_DATABASE_URL (libsql://...) and TURSO_AUTH_TOKEN to
 *   use a hosted Turso database.
 * - Local: falls back to the SQLite file at DATABASE_PATH.
 *
 * Next.js can re-import modules across hot reloads, so we cache the connection
 * on globalThis to avoid opening the database many times in development.
 */
const DB_PATH = process.env.DATABASE_PATH || "./db/studycoach.sqlite";

declare global {
  // eslint-disable-next-line no-var
  var __studycoach_db__: ReturnType<typeof createDb> | undefined;
}

export function databaseUrl(): string {
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL;
  const abs = path.resolve(process.cwd(), DB_PATH);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  return `file:${abs}`;
}

function createDb() {
  const client = createClient({
    url: databaseUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return drizzle(client, { schema });
}

export const db = globalThis.__studycoach_db__ ?? createDb();
if (process.env.NODE_ENV !== "production") globalThis.__studycoach_db__ = db;

export { schema };
