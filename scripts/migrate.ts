import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = process.env.DATABASE_PATH || "./db/studycoach.sqlite";
const abs = path.resolve(process.cwd(), DB_PATH);
fs.mkdirSync(path.dirname(abs), { recursive: true });

const sqlite = new Database(abs);
sqlite.pragma("journal_mode = WAL");
const db = drizzle(sqlite);

console.log(`Applying migrations to ${abs} ...`);
migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations applied.");
sqlite.close();
