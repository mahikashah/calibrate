import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

/**
 * A single shared SQLite connection for the whole app. Next.js can re-import
 * modules across hot reloads, so we cache the connection on globalThis to avoid
 * opening the database file many times in development.
 */
const DB_PATH = process.env.DATABASE_PATH || "./db/studycoach.sqlite";

declare global {
  // eslint-disable-next-line no-var
  var __studycoach_db__: ReturnType<typeof createDb> | undefined;
}

function createDb() {
  const abs = path.resolve(process.cwd(), DB_PATH);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const sqlite = new Database(abs);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export const db = globalThis.__studycoach_db__ ?? createDb();
if (process.env.NODE_ENV !== "production") globalThis.__studycoach_db__ = db;

export { schema };
