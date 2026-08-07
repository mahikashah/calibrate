import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as DbSchema from "../db/schema";

let sharedDb: BetterSQLite3Database<typeof DbSchema>;
let activeUserId = "dash-user";

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
    CREATE TABLE onboarding (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, answers TEXT NOT NULL, hypothesis TEXT NOT NULL, created_at TEXT NOT NULL);
  `);
  sharedDb = drizzle(sqlite, { schema });
  return { db: sharedDb };
});
vi.mock("@/lib/user", () => ({ currentUserId: () => activeUserId }));

const schema = await import("../db/schema");
const { GET: getDashboard } = await import("@/app/api/dashboard/route");
const { GET: getInsights } = await import("@/app/api/insights/route");
const { currentRecommendation } = await import("../recommend");
const { outcomeScore } = await import("../stats");

const now = new Date("2026-08-07T12:00:00.000Z").toISOString();
const at = (dayOffset: number) =>
  new Date(Date.UTC(2026, 6, 1 + dayOffset, 12, 0, 0)).toISOString();

async function dashboard() {
  const response = await getDashboard();
  expect(response.status).toBe(200);
  return response.json();
}

function addSubject(id: string, name = "Biology", userId = "dash-user") {
  sharedDb
    .insert(schema.subjects)
    .values({ id, userId, name, color: "#208B8B", createdAt: now })
    .run();
}

function addMaterial(id: string, subjectId: string, userId = "dash-user") {
  sharedDb
    .insert(schema.materials)
    .values({ id, userId, subjectId, title: "Chapter 1", content: "text", createdAt: now })
    .run();
}

function addQuestion(id: string, subjectId: string, status: string, userId = "dash-user") {
  sharedDb
    .insert(schema.questions)
    .values({
      id,
      userId,
      subjectId,
      materialId: null,
      type: "recall",
      prompt: "Why?",
      answer: "Because",
      answerChoices: null,
      sourceExcerpt: null,
      status,
      source: "ai",
      createdAt: now,
    })
    .run();
}

function addSession(values: {
  id: string;
  subjectId?: string;
  userId?: string;
  technique?: string;
  origin?: "real" | "demo";
  minutes?: number;
  endedAt?: string | null;
  outcome?: { quizScore: number; confidence: number; recall: number } | null;
  feedback?: { overall: "rough" | "good"; calmWired: number; reasons: string[] };
}) {
  const endedAt = values.endedAt === undefined ? now : values.endedAt;
  sharedDb
    .insert(schema.sessions)
    .values({
      id: values.id,
      userId: values.userId ?? "dash-user",
      subjectId: values.subjectId ?? "dash-subject",
      technique: values.technique ?? "active_recall",
      materialId: null,
      plannedMinutes: 25,
      actualMinutes: values.minutes ?? 25,
      notes: "",
      completionKey: null,
      evidenceOrigin: values.origin ?? "real",
      startedAt: endedAt ?? now,
      endedAt,
    })
    .run();
  if (values.outcome !== null) {
    const outcome = values.outcome ?? { quizScore: 80, confidence: 4, recall: 80 };
    sharedDb
      .insert(schema.outcomes)
      .values({
        id: `out-${values.id}`,
        sessionId: values.id,
        quizScore: outcome.quizScore,
        confidence: outcome.confidence,
        recall: outcome.recall,
        notes: "",
        createdAt: endedAt ?? now,
      })
      .run();
  }
  if (values.feedback) {
    sharedDb
      .insert(schema.sessionFeedback)
      .values({
        id: `fb-${values.id}`,
        sessionId: values.id,
        overall: values.feedback.overall,
        calmWired: values.feedback.calmWired,
        reasons: JSON.stringify(values.feedback.reasons),
        createdAt: endedAt ?? now,
      })
      .run();
  }
}

beforeEach(() => {
  activeUserId = "dash-user";
  for (const table of [
    schema.onboarding,
    schema.sessionFeedback,
    schema.outcomes,
    schema.sessions,
    schema.questions,
    schema.materials,
    schema.subjects,
    schema.users,
  ]) {
    sharedDb.delete(table).run();
  }
  sharedDb
    .insert(schema.users)
    .values([
      { id: "dash-user", name: "Dash", createdAt: now },
      { id: "other-user", name: "Other", createdAt: now },
    ])
    .run();
});

describe("Dashboard primary next action", () => {
  it("asks a brand-new student to set up a subject", async () => {
    const data = await dashboard();
    expect(data.nextAction.id).toBe("create_subject");
    expect(data.nextAction.href).toBe("/subjects");
    expect(data.totals).toMatchObject({ subjects: 0, materials: 0, approvedQuestions: 0 });
  });

  it("asks for study material once a subject exists", async () => {
    addSubject("dash-subject");
    const data = await dashboard();
    expect(data.nextAction.id).toBe("add_material");
    expect(data.nextAction.href).toBe("/subjects/dash-subject/materials/new");
  });

  it("sends the student to the Question Bank while questions await review", async () => {
    addSubject("dash-subject");
    addMaterial("dash-material", "dash-subject");
    addQuestion("q1", "dash-subject", "generated");
    addQuestion("q2", "dash-subject", "edited");
    const data = await dashboard();
    expect(data.nextAction.id).toBe("review_questions");
    expect(data.nextAction.href).toBe("/questions");
    expect(data.nextAction.description).toContain("2 questions");
    expect(data.totals.questionsAwaitingReview).toBe(2);
  });

  it("asks for a first study session once questions are approved", async () => {
    addSubject("dash-subject");
    addMaterial("dash-material", "dash-subject");
    addQuestion("q1", "dash-subject", "approved");
    const data = await dashboard();
    expect(data.nextAction.id).toBe("start_session");
    expect(data.nextAction.href).toBe("/study");
    expect(data.evidenceProgress.completedSessions).toBe(0);
  });

  it("asks for another technique while the comparison is inconclusive", async () => {
    addSubject("dash-subject");
    addMaterial("dash-material", "dash-subject");
    addQuestion("q1", "dash-subject", "approved");
    addSession({ id: "s1", technique: "active_recall", endedAt: at(1) });
    const data = await dashboard();
    expect(data.nextAction.id).toBe("try_another_technique");
    expect(data.recommendation.state).toBe("gathering");
    expect(data.recommendation.title).toBe("Still gathering evidence");
  });

  it("points at the leading technique once the evidence supports one", async () => {
    addSubject("dash-subject");
    addMaterial("dash-material", "dash-subject");
    addQuestion("q1", "dash-subject", "approved");
    for (let i = 0; i < 4; i += 1) {
      addSession({ id: `strong-${i}`, technique: "active_recall", endedAt: at(i) });
    }
    const data = await dashboard();
    expect(data.nextAction.id).toBe("study_recommendation");
    expect(data.recommendation.state).toBe("emerging");
    expect(data.recommendation.technique).toBe("Active recall");
    expect(data.nextAction.title).toContain("Active recall");
  });
});

describe("Dashboard evidence and recommendation", () => {
  beforeEach(() => {
    addSubject("dash-subject");
    addMaterial("dash-material", "dash-subject");
    addQuestion("q1", "dash-subject", "approved");
  });

  it("counts only real completed sessions and techniques", async () => {
    addSession({ id: "r1", technique: "active_recall", minutes: 30, endedAt: at(0) });
    addSession({ id: "r2", technique: "feynman", minutes: 20, endedAt: at(1) });
    addSession({ id: "r3", technique: "feynman", minutes: 10, endedAt: null, outcome: null });

    const data = await dashboard();
    expect(data.evidenceProgress).toMatchObject({
      completedSessions: 2,
      outcomeChecks: 2,
      techniquesTried: 2,
      subjectsWithEvidence: 1,
      focusedMinutes: 50,
    });
    expect(data.subjects[0]).toMatchObject({
      id: "dash-subject",
      materialCount: 1,
      approvedQuestions: 1,
      completedSessions: 2,
    });
  });

  it("excludes seeded demo evidence from counts, recent session and recommendation", async () => {
    addSession({ id: "real-1", technique: "active_recall", endedAt: at(0), outcome: { quizScore: 60, confidence: 3, recall: 60 } });
    for (let i = 0; i < 4; i += 1) {
      addSession({
        id: `demo-${i}`,
        technique: "rereading",
        origin: "demo",
        endedAt: at(5 + i),
        outcome: { quizScore: 99, confidence: 5, recall: 99 },
      });
    }

    const data = await dashboard();
    expect(data.evidenceProgress.completedSessions).toBe(1);
    expect(data.evidenceProgress.techniquesTried).toBe(1);
    expect(data.recentSession.sessionId).toBe("real-1");
    expect(data.recommendation.state).toBe("gathering");
    expect(JSON.stringify(data)).not.toContain("demo-");
  });

  it("reuses the deterministic Insights recommendation rather than recomputing one", async () => {
    for (let i = 0; i < 4; i += 1) {
      addSession({
        id: `ar-${i}`,
        technique: "active_recall",
        endedAt: at(i),
        outcome: { quizScore: 90, confidence: 5, recall: 90 },
      });
    }
    for (let i = 0; i < 3; i += 1) {
      addSession({
        id: `rr-${i}`,
        technique: "rereading",
        endedAt: at(10 + i),
        outcome: { quizScore: 40, confidence: 2, recall: 40 },
      });
    }

    const insights = await (
      await getInsights(new Request("http://localhost/api/insights?source=real"))
    ).json();
    const expected = currentRecommendation(insights.report.subjects[0]);
    const data = await dashboard();

    expect(data.recommendation).toEqual(expected);
    expect(data.recommendation.state).toBe("clear");
    expect(data.focusSubject).toMatchObject({
      subjectId: "dash-subject",
      confidence: insights.report.subjects[0].confidence,
    });
  });

  it("falls back to the onboarding starting hypothesis when there is no evidence", async () => {
    sharedDb
      .insert(schema.onboarding)
      .values({
        id: "onb-1",
        userId: "dash-user",
        answers: "{}",
        hypothesis: JSON.stringify({ ranked: [{ label: "Spaced repetition" }] }),
        createdAt: now,
      })
      .run();

    const data = await dashboard();
    expect(data.recommendation.state).toBe("hypothesis");
    expect(data.recommendation.technique).toBe("Spaced repetition");
    expect(data.onboarding).toMatchObject({ completed: true, startingHypothesis: "Spaced repetition" });
  });

  it("shows the latest real session with its performance and feedback context", async () => {
    addSession({ id: "older", technique: "feynman", endedAt: at(0) });
    addSession({
      id: "latest",
      technique: "practice_questions",
      minutes: 40,
      endedAt: at(3),
      outcome: { quizScore: 50, confidence: 2, recall: 40 },
      feedback: { overall: "rough", calmWired: 78, reasons: ["questions_wrong", "material_hard"] },
    });

    const data = await dashboard();
    expect(data.recentSession).toMatchObject({
      sessionId: "latest",
      subjectName: "Biology",
      techniqueLabel: "Practice questions",
      minutes: 40,
      feedbackOverall: "rough",
      calmWired: 78,
    });
    expect(data.recentSession.performance).toBeGreaterThan(0);
    expect(data.recentSession.context.map((item: { label: string }) => item.label)).toEqual([
      "Question quality flagged",
      "Material felt difficult",
    ]);
  });

  it("shows the newest outcome check and stays in step with Insights when a session is re-checked", async () => {
    addSession({
      id: "rechecked",
      technique: "active_recall",
      endedAt: at(3),
      outcome: { quizScore: 40, confidence: 2, recall: 40 },
    });
    // A later review check on the same session — the schema allows several.
    sharedDb
      .insert(schema.outcomes)
      .values({
        id: "out-rechecked-2",
        sessionId: "rechecked",
        quizScore: 90,
        confidence: 5,
        recall: 90,
        notes: "",
        createdAt: at(6),
      })
      .run();

    const data = await dashboard();
    expect(data.recentSession.performance).toBe(outcomeScore({ quizScore: 90, confidence: 5, recall: 90 }));
    // One session, two checks — the labels must not conflate them.
    expect(data.evidenceProgress.completedSessions).toBe(1);
    expect(data.evidenceProgress.outcomeChecks).toBe(2);

    const insights = await (
      await getInsights(new Request("http://localhost/api/insights?source=real"))
    ).json();
    expect(data.recommendation).toEqual(currentRecommendation(insights.report.subjects[0]));
    expect(data.evidenceProgress.outcomeChecks).toBe(insights.report.overall.totalSessions);
  });

  it("counts a completed session with no outcome check without inventing a performance", async () => {
    addSession({ id: "unchecked", technique: "feynman", endedAt: at(4), outcome: null });

    const data = await dashboard();
    expect(data.evidenceProgress).toMatchObject({ completedSessions: 1, outcomeChecks: 0 });
    expect(data.recentSession).toMatchObject({ sessionId: "unchecked", performance: null });
    expect(data.recommendation.state).toBe("gathering");
  });

  it("surfaces question-quality context without treating the technique as failed", async () => {
    for (let i = 0; i < 4; i += 1) {
      addSession({
        id: `ar-${i}`,
        technique: "active_recall",
        endedAt: at(i),
        outcome: { quizScore: 88, confidence: 5, recall: 88 },
        feedback:
          i === 3
            ? { overall: "rough", calmWired: 60, reasons: ["questions_wrong"] }
            : undefined,
      });
    }

    const data = await dashboard();
    expect(data.recentSession.context).toEqual([
      { reason: "questions_wrong", label: "Question quality flagged" },
    ]);
    // The flag is context only: the technique still leads and stays recommended.
    expect(data.recommendation.technique).toBe("Active recall");
    expect(data.nextAction.id).toBe("study_recommendation");
    expect(data.evidenceProgress.completedSessions).toBe(4);
  });
});

describe("Dashboard ownership isolation", () => {
  it("never reports another user's subjects, sessions or evidence", async () => {
    addSubject("other-subject", "Private", "other-user");
    addMaterial("other-material", "other-subject", "other-user");
    addQuestion("other-q", "other-subject", "approved", "other-user");
    addSession({
      id: "other-session",
      userId: "other-user",
      subjectId: "other-subject",
      technique: "rereading",
      endedAt: at(2),
    });

    const data = await dashboard();
    expect(data.subjects).toEqual([]);
    expect(data.recentSession).toBeNull();
    expect(data.evidenceProgress).toMatchObject({ completedSessions: 0, outcomeChecks: 0 });
    expect(data.nextAction.id).toBe("create_subject");
    expect(JSON.stringify(data)).not.toContain("Private");

    activeUserId = "other-user";
    const theirs = await dashboard();
    expect(theirs.subjects.map((subject: { id: string }) => subject.id)).toEqual(["other-subject"]);
    expect(theirs.recentSession.sessionId).toBe("other-session");
  });
});
