import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as DbSchema from "../db/schema";

let sharedDb: BetterSQLite3Database<typeof DbSchema>;
let activeUserId = "study-user";

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
    CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, subject_id TEXT NOT NULL, technique TEXT NOT NULL, material_id TEXT, planned_minutes INTEGER NOT NULL, actual_minutes INTEGER NOT NULL, notes TEXT NOT NULL, completion_key TEXT UNIQUE, started_at TEXT NOT NULL, ended_at TEXT);
    CREATE TABLE outcomes (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, quiz_score REAL NOT NULL, confidence INTEGER NOT NULL, recall REAL NOT NULL, notes TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE session_feedback (id TEXT PRIMARY KEY, session_id TEXT NOT NULL UNIQUE, overall TEXT NOT NULL, calm_wired INTEGER NOT NULL, reasons TEXT NOT NULL, created_at TEXT NOT NULL);
  `);
  sharedDb = drizzle(sqlite, { schema });
  return { db: sharedDb };
});
vi.mock("@/lib/user", () => ({ currentUserId: () => activeUserId }));

const schema = await import("../db/schema");
const { GET: listQuestions } = await import("@/app/api/questions/route");
const { POST: createSession } = await import("@/app/api/sessions/route");
const { POST: createOutcome } = await import("@/app/api/outcomes/route");
const { GET: getSessionFeedback, POST: saveSessionFeedback } = await import("@/app/api/session-feedback/route");

function request(url: string, body?: unknown) {
  return new Request(url, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

beforeEach(() => {
  activeUserId = "study-user";
  for (const table of [schema.sessionFeedback, schema.outcomes, schema.sessions, schema.questions, schema.materials, schema.subjects, schema.users]) sharedDb.delete(table).run();
  const now = new Date().toISOString();
  sharedDb.insert(schema.users).values([{ id: "study-user", name: "Study", createdAt: now }, { id: "other-user", name: "Other", createdAt: now }]).run();
  sharedDb.insert(schema.subjects).values([{ id: "study-subject", userId: "study-user", name: "Biology", color: "#000", createdAt: now }, { id: "other-subject", userId: "other-user", name: "Private", color: "#000", createdAt: now }]).run();
  sharedDb.insert(schema.materials).values([{ id: "study-material", userId: "study-user", subjectId: "study-subject", title: "Cells", content: "Cells divide.", createdAt: now }, { id: "other-material", userId: "other-user", subjectId: "other-subject", title: "Private", content: "Private", createdAt: now }]).run();
  for (const status of ["approved", "generated", "edited", "rejected"]) {
    sharedDb.insert(schema.questions).values({ id: `q-${status}`, userId: "study-user", subjectId: "study-subject", materialId: "study-material", type: "mcq", prompt: status, answer: "A", answerChoices: '["A","B","C","D"]', sourceExcerpt: "Cells divide.", status, source: "ai", createdAt: now }).run();
  }
});

describe("approved study-session API contracts", () => {
  it("returns only approved questions in the validated subject/material scope", async () => {
    const response = await listQuestions(request("http://localhost/api/questions?subjectId=study-subject&materialId=study-material&status=approved"));
    expect(response.status).toBe(200);
    expect((await response.json()).map((row: { id: string }) => row.id)).toEqual(["q-approved"]);
  });

  it("does not permit a foreign subject or material to shape a study query", async () => {
    expect((await listQuestions(request("http://localhost/api/questions?subjectId=other-subject&status=approved"))).status).toBe(404);
    expect((await listQuestions(request("http://localhost/api/questions?subjectId=study-subject&materialId=other-material&status=approved"))).status).toBe(404);
  });

  it("persists a session only for the current user's verified subject/material", async () => {
    const response = await createSession(request("http://localhost/api/sessions", { subjectId: "study-subject", materialId: "study-material", technique: "practice_questions", plannedMinutes: 25, actualMinutes: 3 }));
    expect(response.status).toBe(201);
    expect(sharedDb.select().from(schema.sessions).all()).toHaveLength(1);
    expect((await createSession(request("http://localhost/api/sessions", { subjectId: "other-subject", technique: "practice_questions" }))).status).toBe(404);
  });

  it("returns the original completed session for a retry with the same completion key", async () => {
    const body = { subjectId: "study-subject", materialId: "study-material", technique: "practice_questions", plannedMinutes: 25, actualMinutes: 3, completionKey: "completion-key-123" };
    const first = await createSession(request("http://localhost/api/sessions", body));
    const second = await createSession(request("http://localhost/api/sessions", body));
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(sharedDb.select().from(schema.sessions).all()).toHaveLength(1);
  });

  it("records outcomes only for a session owned by the current user", async () => {
    const now = new Date().toISOString();
    sharedDb.insert(schema.sessions).values({ id: "other-session", userId: "other-user", subjectId: "other-subject", technique: "active_recall", materialId: null, plannedMinutes: 25, actualMinutes: 2, notes: "", completionKey: null, startedAt: now, endedAt: now }).run();
    expect((await createOutcome(request("http://localhost/api/outcomes", { sessionId: "other-session", quizScore: 50, confidence: 3, recall: 50 }))).status).toBe(404);
  });

  it("persists Good feedback and its Calm/Wired value for the owned completed session", async () => {
    const created = await createSession(request("http://localhost/api/sessions", { subjectId: "study-subject", technique: "active_recall", outcome: { quizScore: 80, confidence: 4, recall: 80 } }));
    const { session } = await created.json();
    const response = await saveSessionFeedback(request("http://localhost/api/session-feedback", { sessionId: session.id, overall: "good", calmWired: 22, reasons: [] }));
    expect(response.status).toBe(201);
    const stored = sharedDb.select().from(schema.sessionFeedback).get();
    expect(stored).toMatchObject({ sessionId: session.id, overall: "good", calmWired: 22, reasons: "[]" });
  });

  it("persists Rough feedback with distinct structured reasons and upserts retries", async () => {
    const created = await createSession(request("http://localhost/api/sessions", { subjectId: "study-subject", technique: "active_recall", outcome: { quizScore: 30, confidence: 2, recall: 30 } }));
    const { session } = await created.json();
    const rough = { sessionId: session.id, overall: "rough", calmWired: 88, reasons: ["questions_wrong", "technique_wrong", "material_hard"] };
    expect((await saveSessionFeedback(request("http://localhost/api/session-feedback", rough))).status).toBe(201);
    expect((await saveSessionFeedback(request("http://localhost/api/session-feedback", { ...rough, calmWired: 71, reasons: ["questions_wrong", "distracted_low_energy"] }))).status).toBe(200);
    const all = sharedDb.select().from(schema.sessionFeedback).all();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ overall: "rough", calmWired: 71, reasons: '["questions_wrong","distracted_low_energy"]' });
    expect(JSON.parse(all[0].reasons)).not.toContain("technique_wrong");
  });

  it("does not expose or accept feedback for another user's session", async () => {
    const now = new Date().toISOString();
    sharedDb.insert(schema.sessions).values({ id: "other-completed", userId: "other-user", subjectId: "other-subject", technique: "active_recall", materialId: null, plannedMinutes: 25, actualMinutes: 2, notes: "", completionKey: null, startedAt: now, endedAt: now }).run();
    expect((await getSessionFeedback(new Request("http://localhost/api/session-feedback?sessionId=other-completed"))).status).toBe(404);
    expect((await saveSessionFeedback(request("http://localhost/api/session-feedback", { sessionId: "other-completed", overall: "good", calmWired: 50, reasons: [] }))).status).toBe(404);
  });

  it("rejects missing, invalid, and incomplete feedback sessions without creating evidence", async () => {
    expect((await getSessionFeedback(new Request("http://localhost/api/session-feedback"))).status).toBe(400);
    expect((await saveSessionFeedback(request("http://localhost/api/session-feedback", { sessionId: "missing", overall: "good", calmWired: 50, reasons: [] }))).status).toBe(404);
    const now = new Date().toISOString();
    sharedDb.insert(schema.sessions).values({ id: "incomplete-session", userId: "study-user", subjectId: "study-subject", technique: "active_recall", materialId: null, plannedMinutes: 25, actualMinutes: 2, notes: "", completionKey: null, startedAt: now, endedAt: null }).run();
    expect((await saveSessionFeedback(request("http://localhost/api/session-feedback", { sessionId: "incomplete-session", overall: "good", calmWired: 50, reasons: [] }))).status).toBe(409);
    expect(sharedDb.select().from(schema.sessionFeedback).all()).toHaveLength(0);
  });
});