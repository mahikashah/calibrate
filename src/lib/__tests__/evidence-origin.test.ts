import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as DbSchema from "../db/schema";

let sharedDb: BetterSQLite3Database<typeof DbSchema>;

vi.mock("@/lib/db", async () => {
  const BetterSqlite3 = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const schema = await import("../db/schema");
  const sqlite = new BetterSqlite3(":memory:");
  sqlite.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE subjects (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE materials (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, subject_id TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE questions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, subject_id TEXT NOT NULL, material_id TEXT, type TEXT NOT NULL, prompt TEXT NOT NULL, answer TEXT NOT NULL, answer_choices TEXT, source_excerpt TEXT, status TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, subject_id TEXT NOT NULL, technique TEXT NOT NULL, material_id TEXT, planned_minutes INTEGER NOT NULL, actual_minutes INTEGER NOT NULL, notes TEXT NOT NULL, completion_key TEXT UNIQUE, evidence_origin TEXT NOT NULL DEFAULT 'real', started_at TEXT NOT NULL, ended_at TEXT);
    CREATE TABLE outcomes (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, quiz_score REAL NOT NULL, confidence INTEGER NOT NULL, recall REAL NOT NULL, notes TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE session_feedback (id TEXT PRIMARY KEY, session_id TEXT NOT NULL UNIQUE, overall TEXT NOT NULL, calm_wired INTEGER NOT NULL, reasons TEXT NOT NULL, created_at TEXT NOT NULL);
  `);
  sharedDb = drizzle(sqlite, { schema });
  return { db: sharedDb };
});
vi.mock("@/lib/user", () => ({ currentUserId: () => "study-user" }));

const schema = await import("../db/schema");
const { POST: createSession } = await import("@/app/api/sessions/route");
const { GET: getInsights } = await import("@/app/api/insights/route");

const now = new Date("2026-08-07T12:00:00.000Z").toISOString();

function request(url: string, body?: unknown) {
  return new Request(url, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

function insertCompletedSession(values: {
  id: string;
  origin: "real" | "demo";
  technique?: string;
  quizScore?: number;
}) {
  sharedDb
    .insert(schema.sessions)
    .values({
      id: values.id,
      userId: "study-user",
      subjectId: "study-subject",
      technique: values.technique ?? "active_recall",
      materialId: null,
      plannedMinutes: 25,
      actualMinutes: 25,
      notes: "",
      completionKey: null,
      evidenceOrigin: values.origin,
      startedAt: now,
      endedAt: now,
    })
    .run();
  sharedDb
    .insert(schema.outcomes)
    .values({
      id: `out-${values.id}`,
      sessionId: values.id,
      quizScore: values.quizScore ?? 80,
      confidence: 4,
      recall: values.quizScore ?? 80,
      notes: "",
      createdAt: now,
    })
    .run();
}

beforeEach(() => {
  for (const table of [schema.sessionFeedback, schema.outcomes, schema.sessions, schema.subjects, schema.users]) {
    sharedDb.delete(table).run();
  }
  sharedDb.insert(schema.users).values({ id: "study-user", name: "Study", createdAt: now }).run();
  sharedDb
    .insert(schema.subjects)
    .values({ id: "study-subject", userId: "study-user", name: "Biology", color: "#000", createdAt: now })
    .run();
});

describe("evidence_origin classification", () => {
  it("keeps legacy sessions as real after migration 0005", () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE subjects (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        technique TEXT NOT NULL,
        material_id TEXT,
        planned_minutes INTEGER NOT NULL DEFAULT 25,
        actual_minutes INTEGER NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        completion_key TEXT UNIQUE,
        started_at TEXT NOT NULL,
        ended_at TEXT
      );
    `);
    sqlite.prepare(`INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)`).run("u1", "Alex", now);
    sqlite.prepare(`INSERT INTO subjects (id, user_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)`).run(
      "s1",
      "u1",
      "Biology",
      "#000",
      now,
    );
    sqlite
      .prepare(
        `INSERT INTO sessions (id, user_id, subject_id, technique, material_id, planned_minutes, actual_minutes, notes, completion_key, started_at, ended_at)
         VALUES (?, ?, ?, ?, NULL, 25, 25, '', NULL, ?, ?)`,
      )
      .run("legacy-session", "u1", "s1", "active_recall", now, now);

    const columnsBefore = sqlite.prepare(`PRAGMA table_info(sessions)`).all() as { name: string }[];
    expect(columnsBefore.some((column) => column.name === "evidence_origin")).toBe(false);

    const migrationSql = fs.readFileSync(
      path.resolve(process.cwd(), "drizzle/0005_session_evidence_origin.sql"),
      "utf8",
    );
    expect(migrationSql).toMatch(/DEFAULT\s+'real'/i);
    expect(migrationSql).not.toMatch(/UPDATE\s+.*evidence_origin\s*=\s*'demo'/i);
    sqlite.exec(migrationSql);

    const legacy = sqlite
      .prepare(`SELECT evidence_origin AS evidenceOrigin FROM sessions WHERE id = ?`)
      .get("legacy-session") as { evidenceOrigin: string };
    expect(legacy.evidenceOrigin).toBe("real");
    sqlite.close();
  });

  it("creates seeded presentation sessions with evidenceOrigin demo", () => {
    const seedSource = fs.readFileSync(path.resolve(process.cwd(), "scripts/seed.ts"), "utf8");
    expect(seedSource).toMatch(/evidenceOrigin:\s*"demo"/);

    // Mirror the seed insert contract against an isolated DB.
    sharedDb
      .insert(schema.sessions)
      .values({
        id: "seeded-demo",
        userId: "study-user",
        subjectId: "study-subject",
        technique: "practice_questions",
        materialId: null,
        plannedMinutes: 25,
        actualMinutes: 25,
        notes: "",
        evidenceOrigin: "demo",
        startedAt: now,
        endedAt: now,
      })
      .run();

    const row = sharedDb.select().from(schema.sessions).all()[0];
    expect(row).toMatchObject({ id: "seeded-demo", evidenceOrigin: "demo" });
  });

  it("creates a normal Study Session with evidence_origin real", async () => {
    const response = await createSession(
      request("http://localhost/api/sessions", {
        subjectId: "study-subject",
        technique: "active_recall",
        plannedMinutes: 25,
        actualMinutes: 20,
      }),
    );
    expect(response.status).toBe(201);
    const stored = sharedDb.select().from(schema.sessions).all();
    expect(stored).toHaveLength(1);
    expect(stored[0].evidenceOrigin).toBe("real");
  });

  it("keeps real and demo Insights evidence isolated", async () => {
    insertCompletedSession({ id: "real-a", origin: "real", technique: "active_recall", quizScore: 70 });
    insertCompletedSession({ id: "demo-b", origin: "demo", technique: "rereading", quizScore: 95 });

    const real = await (await getInsights(new Request("http://localhost/api/insights?source=real"))).json();
    const demo = await (await getInsights(new Request("http://localhost/api/insights?source=demo"))).json();

    expect(real.source).toBe("real");
    expect(demo.source).toBe("demo");
    expect(real.recentEvidence.map((row: { sessionId: string }) => row.sessionId)).toEqual(["real-a"]);
    expect(demo.recentEvidence.map((row: { sessionId: string }) => row.sessionId)).toEqual(["demo-b"]);
    expect(real.report.subjects[0].best.technique).toBe("active_recall");
    expect(demo.report.subjects[0].best.technique).toBe("rereading");
  });
});
