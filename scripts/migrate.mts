import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import fs from "node:fs";
import path from "node:path";

// Uses Turso when TURSO_DATABASE_URL is set, otherwise the local SQLite file.
function databaseUrl(): string {
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL;
  const abs = path.resolve(process.cwd(), process.env.DATABASE_PATH || "./db/studycoach.sqlite");
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  return `file:${abs}`;
}

const url = databaseUrl();
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const db = drizzle(client);

console.log(`Applying migrations to ${url.startsWith("file:") ? url : new URL(url).host} ...`);
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations applied.");
client.close();
