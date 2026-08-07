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
    CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, subject_id TEXT NOT NULL, technique TEXT NOT NULL, material_id TEXT, planned_minutes INTEGER NOT NULL, actual_minutes INTEGER NOT NULL, notes TEXT NOT NULL, completion_key TEXT UNIQUE, evidence_origin TEXT NOT NULL DEFAULT 'real', started_at TEXT NOT NULL, ended_at TEXT);
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
const { GET: getInsights } = await import("@/app/api/insights/route");

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
    expect(sharedDb.select().from(schema.sessions).get()?.evidenceOrigin).toBe("real");
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

describe("transparent Insights evidence", () => {
  const now = new Date("2026-08-07T12:00:00.000Z").toISOString();

  function addEvidence(values: {
    id: string;
    userId?: string;
    subjectId?: string;
    technique: string;
    origin?: "real" | "demo";
    quizScore?: number;
    confidence?: number;
    recall?: number;
    minutes?: number;
    feedback?: { overall: "rough" | "good"; calmWired: number; reasons: string[] };
  }) {
    const userId = values.userId ?? "study-user";
    const subjectId = values.subjectId ?? "study-subject";
    sharedDb.insert(schema.sessions).values({
      id: values.id,
      userId,
      subjectId,
      technique: values.technique,
      materialId: null,
      plannedMinutes: 25,
      actualMinutes: values.minutes ?? 25,
      notes: "",
      completionKey: null,
      evidenceOrigin: values.origin ?? "real",
      startedAt: now,
      endedAt: now,
    }).run();
    sharedDb.insert(schema.outcomes).values({
      id: `out-${values.id}`,
      sessionId: values.id,
      quizScore: values.quizScore ?? 80,
      confidence: values.confidence ?? 4,
      recall: values.recall ?? 80,
      notes: "",
      createdAt: now,
    }).run();
    if (values.feedback) {
      sharedDb.insert(schema.sessionFeedback).values({
        id: `feedback-${values.id}`,
        sessionId: values.id,
        ...values.feedback,
        reasons: JSON.stringify(values.feedback.reasons),
        createdAt: now,
      }).run();
    }
  }

  it("returns only the current user's real completed evidence with calculated technique totals", async () => {
    addEvidence({ id: "real-1", technique: "active_recall", quizScore: 80, recall: 80, confidence: 4, minutes: 30 });
    addEvidence({ id: "demo-1", technique: "rereading", origin: "demo", quizScore: 100, recall: 100, confidence: 5 });
    addEvidence({ id: "other-1", userId: "other-user", subjectId: "other-subject", technique: "rereading", quizScore: 100, recall: 100, confidence: 5 });

    const response = await getInsights(new Request("http://localhost/api/insights"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.source).toBe("real");
    expect(body.report.overall).toMatchObject({ totalSessions: 1, totalMinutes: 30 });
    expect(body.report.subjects[0].techniques[0]).toMatchObject({ technique: "active_recall", n: 1, avgScore: 79 });
    expect(body.recentEvidence).toHaveLength(1);
  });

  it("keeps demo evidence available separately and never mixes it into real recommendations", async () => {
    addEvidence({ id: "real-1", technique: "active_recall", quizScore: 60, recall: 60 });
    addEvidence({ id: "demo-1", technique: "rereading", origin: "demo", quizScore: 100, recall: 100, confidence: 5 });
    const real = await (await getInsights(new Request("http://localhost/api/insights?source=real"))).json();
    const demo = await (await getInsights(new Request("http://localhost/api/insights?source=demo"))).json();
    expect(real.report.subjects[0].best.technique).toBe("active_recall");
    expect(demo.sourceLabel).toMatch(/presentation/i);
    expect(demo.report.subjects[0].best.technique).toBe("rereading");
  });

  it("filters only owned subject evidence and attaches feedback context to the right session", async () => {
    addEvidence({ id: "real-flagged", technique: "practice_questions", feedback: { overall: "rough", calmWired: 77, reasons: ["questions_wrong", "technique_wrong"] } });
    addEvidence({ id: "other-1", userId: "other-user", subjectId: "other-subject", technique: "active_recall" });
    const response = await getInsights(new Request("http://localhost/api/insights?subjectId=study-subject"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.recentEvidence[0]).toMatchObject({ feedbackOverall: "rough", calmWired: 77 });
    expect(body.recentEvidence[0].feedbackReasons).toEqual(["questions_wrong", "technique_wrong"]);
    expect(body.recentEvidence[0].context.map((item: { message: string }) => item.message)).toContain("Question quality may have affected this session.");
    expect(body.report.subjects[0].best.technique).toBe("practice_questions");
    expect((await getInsights(new Request("http://localhost/api/insights?subjectId=other-subject"))).status).toBe(404);
  });

  it("supports historical sessions without feedback and reports insufficient evidence", async () => {
    addEvidence({ id: "real-history", technique: "feynman" });
    const body = await (await getInsights(new Request("http://localhost/api/insights"))).json();
    expect(body.recentEvidence[0]).toMatchObject({ feedbackOverall: null, calmWired: null, feedbackReasons: [] });
    expect(body.report.subjects[0].confidence).toBe("insufficient");
  });
});