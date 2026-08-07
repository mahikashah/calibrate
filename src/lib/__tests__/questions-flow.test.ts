/**
 * Guards the question-generation flow:
 *
 *   1. Each notes submission creates a distinct `materials` row first.
 *   2. Generated questions are saved with that material's ID so they stay
 *      linked after a page refresh.
 *   3. The user-selected `count` is forwarded to the ML service.
 *   4. Ownership checks reject wrong-user subjects and materials.
 *   5. ML service errors are translated to appropriate HTTP status codes.
 *   6. Generated questions are stored with status "generated" and the new
 *      structured fields (answerChoices, sourceExcerpt).
 *
 * All tests mock @/lib/ml-service so no real Hugging Face request is made.
 */

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as DbSchema from "../db/schema";

// ---------------------------------------------------------------------------
// Shared database instance — populated by the vi.mock factory below.
// ---------------------------------------------------------------------------
let sharedDb: BetterSQLite3Database<typeof DbSchema>;
const SEED_USER_ID = "test-user";
const SEED_SUBJECT_ID = "test-subject";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Replace the real DB with an in-memory SQLite database that uses the same
// Drizzle schema, including the new ML question fields.
vi.mock("@/lib/db", async () => {
  const BetterSqlite3 = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const schema = await import("../db/schema");

  const sqlite = new BetterSqlite3(":memory:");
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE subjects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at TEXT NOT NULL
    );
    CREATE TABLE materials (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE questions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      material_id TEXT,
      type TEXT NOT NULL DEFAULT 'recall',
      prompt TEXT NOT NULL,
      answer TEXT NOT NULL DEFAULT '',
      answer_choices TEXT,
      source_excerpt TEXT,
      status TEXT NOT NULL DEFAULT 'generated',
      source TEXT NOT NULL DEFAULT 'ai',
      created_at TEXT NOT NULL
    );
  `);

  const db = drizzle(sqlite, { schema });
  sharedDb = db;

  db.insert(schema.users)
    .values({ id: SEED_USER_ID, name: "Test", createdAt: new Date().toISOString() })
    .run();
  db.insert(schema.subjects)
    .values({
      id: SEED_SUBJECT_ID,
      userId: SEED_USER_ID,
      name: "Science",
      color: "#6366f1",
      createdAt: new Date().toISOString(),
    })
    .run();

  return { db };
});

// Always resolve to the seeded test user.
vi.mock("@/lib/user", () => ({
  currentUserId: () => SEED_USER_ID,
  DEFAULT_USER_ID: SEED_USER_ID,
  getCurrentUser: () => ({ id: SEED_USER_ID, name: "Test", createdAt: new Date().toISOString() }),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(data), {
        ...(init ?? {}),
        headers: { "content-type": "application/json" },
      }),
  },
}));

// Mock the FastAPI ML service client — no real Hugging Face call is made.
// vi.fn() wrappers let individual tests override with mockRejectedValueOnce.
vi.mock("@/lib/ml-service", async () => {
  const { MlServiceError } = await import("../ml-service");
  return {
    MlServiceError,
    generateQuestions: vi.fn(async ({ requestedCount }: { requestedCount: number }) =>
      Array.from({ length: requestedCount }, (_, i) => ({
        type: "active_recall" as const,
        question: `Test question ${i + 1}`,
        answer: `Test answer ${i + 1}`,
        answer_choices: [] as string[],
        source_excerpt: "Supporting excerpt from the notes.",
      })),
    ),
    parsePdf: vi.fn(async () => ({
      text: "Extracted PDF text",
      word_count: 100,
      approx_token_count: 133,
      file_name: "test.pdf",
    })),
  };
});

// ---------------------------------------------------------------------------
// Route handlers (imported after mocks are registered)
// ---------------------------------------------------------------------------
const { POST: createMaterial } = await import("@/app/api/materials/route");
const { POST: generateQuestions } = await import("@/app/api/questions/generate/route");
const { POST: uploadPdf } = await import("@/app/api/pdf/route");
const { GET: listQuestions, PATCH: bulkApprove } = await import("@/app/api/questions/route");
const { PATCH: updateQuestion } = await import("@/app/api/questions/[id]/route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
import * as schema from "../db/schema";
import * as mlService from "../ml-service";

function clearGeneratedRows() {
  sharedDb.delete(schema.questions).run();
  sharedDb.delete(schema.materials).run();
}

function postRequest(body: unknown): Request {
  return new Request("http://localhost", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function patchRequest(body: unknown): Request {
  return new Request("http://localhost", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function pdfUploadRequest(subjectId: string, count = 2): Request {
  const form = new FormData();
  form.set("subjectId", subjectId);
  form.set("count", String(count));
  form.set("file", new File(["%PDF-test"], "lecture.pdf", { type: "application/pdf" }));
  return new Request("http://localhost/api/pdf", { method: "POST", body: form });
}

async function jsonBody<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Question-Bank persistence flow", () => {
  beforeEach(clearGeneratedRows);

  it("notes submission creates a material row before generation proceeds", async () => {
    const matRes = await createMaterial(
      postRequest({
        subjectId: SEED_SUBJECT_ID,
        title: "Week 1 notes",
        content: "Photosynthesis converts sunlight into chemical energy stored in glucose.",
      }),
    );

    expect(matRes.status).toBe(201);
    const material = await jsonBody<{ id: string; title: string }>(matRes);
    expect(material.id).toBeTruthy();
    expect(material.title).toBe("Week 1 notes");

    const saved = sharedDb
      .select()
      .from(schema.materials)
      .where(eq(schema.materials.id, material.id))
      .get();
    expect(saved).toBeDefined();
    expect(saved?.content).toContain("Photosynthesis");
  });

  it("generated questions retain the material link and are returned by a subsequent list request", async () => {
    const matRes = await createMaterial(
      postRequest({
        subjectId: SEED_SUBJECT_ID,
        title: "Cell biology",
        content:
          "The mitochondria is the powerhouse of the cell. It produces ATP through cellular respiration.",
      }),
    );
    const { id: materialId } = await jsonBody<{ id: string }>(matRes);

    const genRes = await generateQuestions(
      postRequest({
        subjectId: SEED_SUBJECT_ID,
        materialId,
        count: 3,
      }),
    );

    expect(genRes.status).toBe(201);
    const { questions: generated } = await jsonBody<{
      questions: Array<{ id: string; materialId: string | null }>;
    }>(genRes);

    expect(generated.length).toBeGreaterThan(0);
    for (const q of generated) {
      expect(q.materialId).toBe(materialId);
    }

    const listRes = await listQuestions(new Request("http://localhost/api/questions"));
    const persisted = await jsonBody<Array<{ id: string; materialId: string | null }>>(listRes);
    const generatedIds = new Set(generated.map((q) => q.id));
    for (const q of persisted.filter((q) => generatedIds.has(q.id))) {
      expect(q.materialId).toBe(materialId);
    }
  });

  it("generated questions are stored with status 'generated' and structured ML fields", async () => {
    const matRes = await createMaterial(
      postRequest({
        subjectId: SEED_SUBJECT_ID,
        title: "Physics notes",
        content: "Newton's first law: an object at rest stays at rest.",
      }),
    );
    const { id: materialId } = await jsonBody<{ id: string }>(matRes);

    const genRes = await generateQuestions(
      postRequest({ subjectId: SEED_SUBJECT_ID, materialId, count: 2 }),
    );
    expect(genRes.status).toBe(201);

    // Verify directly in DB — not just the API response.
    const rows = sharedDb
      .select()
      .from(schema.questions)
      .where(eq(schema.questions.materialId, materialId))
      .all();

    expect(rows.length).toBe(2);
    for (const row of rows) {
      expect(row.status).toBe("generated");
      expect(row.subjectId).toBe(SEED_SUBJECT_ID);
      expect(row.materialId).toBe(materialId);
      // answerChoices stored as JSON string
      expect(JSON.parse(row.answerChoices ?? "[]")).toEqual([]);
      // sourceExcerpt set
      expect(row.sourceExcerpt).toBeTruthy();
    }
  });

  it("passes the user-selected question count to the ML service", async () => {
    async function generateWithCount(content: string, count: number) {
      const matRes = await createMaterial(
        postRequest({ subjectId: SEED_SUBJECT_ID, title: "Notes", content }),
      );
      const { id: materialId } = await jsonBody<{ id: string }>(matRes);
      const genRes = await generateQuestions(
        postRequest({ subjectId: SEED_SUBJECT_ID, materialId, count }),
      );
      const { questions } = await jsonBody<{ questions: unknown[] }>(genRes);
      clearGeneratedRows();
      return questions;
    }

    const longContent =
      "Newton's first law states that an object at rest stays at rest and an object " +
      "in motion stays in motion unless acted upon by an unbalanced force. " +
      "The second law relates force, mass, and acceleration: F equals ma. " +
      "The third law states every action has an equal and opposite reaction.";

    const twoQuestions = await generateWithCount(longContent, 2);
    expect(twoQuestions).toHaveLength(2);

    const fourQuestions = await generateWithCount(longContent, 4);
    expect(fourQuestions).toHaveLength(4);
  });

  it("uses deterministic structured questions through the normal persistence path only in demo mode", async () => {
    const previousDemoMode = process.env.CALIBRATE_DEMO_MODE;
    process.env.CALIBRATE_DEMO_MODE = "true";
    try {
      const callsBefore = vi.mocked(mlService.generateQuestions).mock.calls.length;
      const res = await generateQuestions(
        postRequest({
          subjectId: SEED_SUBJECT_ID,
          materialText: "Sampling variability decreases as random sample size increases.",
          count: 4,
        }),
      );
      expect(res.status).toBe(201);
      const body = await jsonBody<{ provider: string; questions: Array<{ id: string }> }>(res);
      expect(body.provider).toBe("calibrate-demo");
      expect(vi.mocked(mlService.generateQuestions).mock.calls).toHaveLength(callsBefore);
      const rows = body.questions.map((question) =>
        sharedDb.select().from(schema.questions).where(eq(schema.questions.id, question.id)).get(),
      );
      expect(rows).toHaveLength(4);
      expect(rows.every((row) => row?.status === "generated" && !!row.sourceExcerpt && !!row.answerChoices)).toBe(true);
    } finally {
      if (previousDemoMode === undefined) delete process.env.CALIBRATE_DEMO_MODE;
      else process.env.CALIBRATE_DEMO_MODE = previousDemoMode;
    }
  });

  it("generate route returns 422 when count is 0", async () => {
    const res = await generateQuestions(
      postRequest({ subjectId: SEED_SUBJECT_ID, materialText: "Some content.", count: 0 }),
    );
    expect(res.status).toBe(422);
  });

  it("generate route returns 422 when count exceeds 10 (FastAPI limit)", async () => {
    const res = await generateQuestions(
      postRequest({ subjectId: SEED_SUBJECT_ID, materialText: "Some content.", count: 11 }),
    );
    expect(res.status).toBe(422);
  });

  it("materials route rejects an empty title", async () => {
    const res = await createMaterial(
      postRequest({ subjectId: SEED_SUBJECT_ID, title: "", content: "Some valid content." }),
    );
    expect(res.status).toBe(422);
  });

  it("materials route rejects empty content", async () => {
    const res = await createMaterial(
      postRequest({ subjectId: SEED_SUBJECT_ID, title: "Valid title", content: "" }),
    );
    expect(res.status).toBe(422);
  });

  it("generate route returns 404 when materialId references a non-existent row", async () => {
    const res = await generateQuestions(
      postRequest({ subjectId: SEED_SUBJECT_ID, materialId: "mat_does_not_exist", count: 3 }),
    );
    expect(res.status).toBe(404);
  });

  it("generate route returns 404 when subjectId references a non-existent row", async () => {
    const res = await generateQuestions(
      postRequest({ subjectId: "sub_does_not_exist", materialText: "Some content.", count: 3 }),
    );
    expect(res.status).toBe(404);
  });

  it("generate route returns 404 when subjectId belongs to a different user", async () => {
    const OTHER_USER_ID = "other-user";
    const OTHER_SUBJECT_ID = "other-subject";
    sharedDb
      .insert(schema.users)
      .values({ id: OTHER_USER_ID, name: "Other", createdAt: new Date().toISOString() })
      .run();
    sharedDb
      .insert(schema.subjects)
      .values({
        id: OTHER_SUBJECT_ID,
        userId: OTHER_USER_ID,
        name: "Other Science",
        color: "#6366f1",
        createdAt: new Date().toISOString(),
      })
      .run();

    const res = await generateQuestions(
      postRequest({ subjectId: OTHER_SUBJECT_ID, materialText: "Some content.", count: 3 }),
    );
    expect(res.status).toBe(404);
  });

  it("generate route returns 404 when materialId belongs to a different user", async () => {
    const OTHER_USER_ID = "other-user-materials-route";
    const OTHER_SUBJECT_ID = "other-subject-materials-route";
    const OTHER_MAT_ID = "other-mat";
    sharedDb
      .insert(schema.users)
      .values({ id: OTHER_USER_ID, name: "Other", createdAt: new Date().toISOString() })
      .run();
    sharedDb
      .insert(schema.subjects)
      .values({
        id: OTHER_SUBJECT_ID,
        userId: OTHER_USER_ID,
        name: "Other Science",
        color: "#6366f1",
        createdAt: new Date().toISOString(),
      })
      .run();
    sharedDb
      .insert(schema.materials)
      .values({
        id: OTHER_MAT_ID,
        userId: OTHER_USER_ID,
        subjectId: OTHER_SUBJECT_ID,
        title: "Other notes",
        content: "Other content",
        createdAt: new Date().toISOString(),
      })
      .run();

    // Current user tries to generate under their subject but with another user's material.
    const res = await generateQuestions(
      postRequest({ subjectId: SEED_SUBJECT_ID, materialId: OTHER_MAT_ID, count: 3 }),
    );
    expect(res.status).toBe(404);
  });

  it("rejects a current user's material when it belongs to another subject", async () => {
    const SECOND_SUBJECT_ID = "test-subject-two";
    const materialId = "wrong-subject-material";
    sharedDb
      .insert(schema.subjects)
      .values({
        id: SECOND_SUBJECT_ID,
        userId: SEED_USER_ID,
        name: "Mathematics",
        color: "#6366f1",
        createdAt: new Date().toISOString(),
      })
      .run();
    sharedDb
      .insert(schema.materials)
      .values({
        id: materialId,
        userId: SEED_USER_ID,
        subjectId: SECOND_SUBJECT_ID,
        title: "Other subject notes",
        content: "Notes linked to another subject.",
        createdAt: new Date().toISOString(),
      })
      .run();

    const res = await generateQuestions(
      postRequest({ subjectId: SEED_SUBJECT_ID, materialId, count: 3 }),
    );

    expect(res.status).toBe(422);
  });

  it("generate route returns 422 when subjectId is missing", async () => {
    const res = await generateQuestions(
      postRequest({ materialText: "Some content.", count: 3 }),
    );
    expect(res.status).toBe(422);
  });

  it("generate route returns 422 when subjectId is blank", async () => {
    const res = await generateQuestions(
      postRequest({ subjectId: "", materialText: "Some content.", count: 3 }),
    );
    expect(res.status).toBe(422);
  });

  it("materials route returns 404 when subjectId does not exist", async () => {
    const res = await createMaterial(
      postRequest({
        subjectId: "sub_does_not_exist",
        title: "Orphan notes",
        content: "Some content that should not be saved.",
      }),
    );
    expect(res.status).toBe(404);
  });

  it("materials route returns 404 when subjectId belongs to a different user", async () => {
    const OTHER_USER_ID = "other-user-mat";
    const OTHER_SUBJECT_ID = "other-subject-mat";
    sharedDb
      .insert(schema.users)
      .values({ id: OTHER_USER_ID, name: "Other", createdAt: new Date().toISOString() })
      .run();
    sharedDb
      .insert(schema.subjects)
      .values({
        id: OTHER_SUBJECT_ID,
        userId: OTHER_USER_ID,
        name: "Other Science",
        color: "#6366f1",
        createdAt: new Date().toISOString(),
      })
      .run();

    const res = await createMaterial(
      postRequest({
        subjectId: OTHER_SUBJECT_ID,
        title: "Stolen notes",
        content: "Content that should be rejected.",
      }),
    );
    expect(res.status).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // ML service error mapping
  // ---------------------------------------------------------------------------

  it("returns 503 when ML service is unavailable", async () => {
    const { MlServiceError } = await import("../ml-service");
    vi.mocked(mlService.generateQuestions).mockRejectedValueOnce(
      new MlServiceError(
        "ML_SERVICE_UNAVAILABLE",
        "Connection refused",
        "Question generation is temporarily unavailable. Please try again.",
      ),
    );

    const matRes = await createMaterial(
      postRequest({ subjectId: SEED_SUBJECT_ID, title: "Notes", content: "Some content." }),
    );
    const { id: materialId } = await jsonBody<{ id: string }>(matRes);

    const res = await generateQuestions(
      postRequest({ subjectId: SEED_SUBJECT_ID, materialId, count: 3 }),
    );
    expect(res.status).toBe(503);
    const body = await jsonBody<{ error: string }>(res);
    expect(body.error).toContain("unavailable");
  });

  it("returns 422 when ML service reports NOTES_TOO_LONG", async () => {
    const { MlServiceError } = await import("../ml-service");
    vi.mocked(mlService.generateQuestions).mockRejectedValueOnce(
      new MlServiceError(
        "NOTES_TOO_LONG",
        "Input exceeds word limit",
        "This material is too long. Try one lecture, chapter, or study section at a time.",
      ),
    );

    const res = await generateQuestions(
      postRequest({ subjectId: SEED_SUBJECT_ID, materialText: "A".repeat(100), count: 3 }),
    );
    expect(res.status).toBe(422);
    const body = await jsonBody<{ error: string }>(res);
    expect(body.error).toContain("too long");
  });

  it("returns 502 when ML service returns INVALID_MODEL_RESPONSE", async () => {
    const { MlServiceError } = await import("../ml-service");
    vi.mocked(mlService.generateQuestions).mockRejectedValueOnce(
      new MlServiceError(
        "INVALID_MODEL_RESPONSE",
        "JSON decode failed",
        "We couldn't generate valid questions from this material. Please try again.",
      ),
    );

    const res = await generateQuestions(
      postRequest({ subjectId: SEED_SUBJECT_ID, materialText: "Some content.", count: 3 }),
    );
    expect(res.status).toBe(502);
  });

  it("generated questions are linked to the correct subject in the database", async () => {
    const matRes = await createMaterial(
      postRequest({
        subjectId: SEED_SUBJECT_ID,
        title: "Linked subject test",
        content: "Some study notes for subject linkage test.",
      }),
    );
    const { id: materialId } = await jsonBody<{ id: string }>(matRes);

    await generateQuestions(
      postRequest({ subjectId: SEED_SUBJECT_ID, materialId, count: 2 }),
    );

    const rows = sharedDb
      .select()
      .from(schema.questions)
      .where(eq(schema.questions.materialId, materialId))
      .all();

    for (const row of rows) {
      expect(row.subjectId).toBe(SEED_SUBJECT_ID);
    }
  });

  it("parses a PDF through the server route and persists linked material and questions", async () => {
    const res = await uploadPdf(pdfUploadRequest(SEED_SUBJECT_ID, 2));

    expect(res.status).toBe(201);
    const body = await jsonBody<{ materialId: string; questionCount: number }>(res);
    expect(body.questionCount).toBe(2);

    const material = sharedDb
      .select()
      .from(schema.materials)
      .where(eq(schema.materials.id, body.materialId))
      .get();
    expect(material).toMatchObject({
      userId: SEED_USER_ID,
      subjectId: SEED_SUBJECT_ID,
      title: "test",
      content: "Extracted PDF text",
    });

    const linkedQuestions = sharedDb
      .select()
      .from(schema.questions)
      .where(eq(schema.questions.materialId, body.materialId))
      .all();
    expect(linkedQuestions).toHaveLength(2);
    expect(linkedQuestions.every((question) => question.status === "generated")).toBe(true);
  });

  it("returns a safe validation error when PDF parsing fails", async () => {
    const { MlServiceError } = await import("../ml-service");
    vi.mocked(mlService.parsePdf).mockRejectedValueOnce(
      new MlServiceError(
        "UNSUPPORTED_PDF",
        "No extractable text",
        "This PDF appears to be scanned. Please use a text-based PDF or paste your notes.",
      ),
    );

    const res = await uploadPdf(pdfUploadRequest(SEED_SUBJECT_ID));

    expect(res.status).toBe(422);
    const body = await jsonBody<{ error: string }>(res);
    expect(body.error).toContain("text-based PDF");
    expect(sharedDb.select().from(schema.materials).all()).toHaveLength(0);
  });

  it("approves a generated question without changing its structured data", async () => {
    const generated = await generateQuestions(
      postRequest({ subjectId: SEED_SUBJECT_ID, materialText: "A concept has evidence.", count: 1 }),
    );
    const { questions } = await jsonBody<{ questions: Array<{ id: string }> }>(generated);
    const before = sharedDb.select().from(schema.questions).where(eq(schema.questions.id, questions[0].id)).get()!;

    const res = await updateQuestion(patchRequest({ action: "approve" }), { params: { id: before.id } });
    expect(res.status).toBe(200);
    const after = sharedDb.select().from(schema.questions).where(eq(schema.questions.id, before.id)).get()!;
    expect(after.status).toBe("approved");
    expect(after).toMatchObject({
      subjectId: before.subjectId,
      materialId: before.materialId,
      answer: before.answer,
      answerChoices: before.answerChoices,
      sourceExcerpt: before.sourceExcerpt,
    });
  });

  it("edits a generated question and then allows approval", async () => {
    const generated = await generateQuestions(
      postRequest({ subjectId: SEED_SUBJECT_ID, materialText: "A concept has evidence.", count: 1 }),
    );
    const { questions } = await jsonBody<{ questions: Array<{ id: string }> }>(generated);
    const id = questions[0].id;

    expect(
      (await updateQuestion(patchRequest({ action: "edit", prompt: "Explain the concept.", answer: "It has evidence.", answerChoices: [] }), { params: { id } })).status,
    ).toBe(200);
    expect(sharedDb.select().from(schema.questions).where(eq(schema.questions.id, id)).get()?.status).toBe("edited");

    await updateQuestion(patchRequest({ action: "approve" }), { params: { id } });
    expect(sharedDb.select().from(schema.questions).where(eq(schema.questions.id, id)).get()?.status).toBe("approved");
  });

  it("rejects questions without deleting them and excludes them from approved eligibility", async () => {
    const generated = await generateQuestions(
      postRequest({ subjectId: SEED_SUBJECT_ID, materialText: "A concept has evidence.", count: 1 }),
    );
    const { questions } = await jsonBody<{ questions: Array<{ id: string }> }>(generated);
    const id = questions[0].id;
    await updateQuestion(patchRequest({ action: "reject" }), { params: { id } });

    const row = sharedDb.select().from(schema.questions).where(eq(schema.questions.id, id)).get();
    expect(row?.status).toBe("rejected");
    const approved = sharedDb.select().from(schema.questions).all().filter((question) => question.status === "approved");
    expect(approved.map((question) => question.id)).not.toContain(id);
  });

  it("rejects invalid multiple-choice edits", async () => {
    sharedDb.insert(schema.questions).values({
      id: "mcq-question",
      userId: SEED_USER_ID,
      subjectId: SEED_SUBJECT_ID,
      type: "mcq",
      prompt: "Which option?",
      answer: "Correct",
      answerChoices: JSON.stringify(["Correct", "A", "B", "C"]),
      sourceExcerpt: "Notes",
      status: "generated",
      source: "ai",
      createdAt: new Date().toISOString(),
    }).run();

    const res = await updateQuestion(
      patchRequest({ action: "edit", prompt: "Which option?", answer: "Not listed", answerChoices: ["Correct", "A", "B", "C"] }),
      { params: { id: "mcq-question" } },
    );
    expect(res.status).toBe(422);
    expect(sharedDb.select().from(schema.questions).where(eq(schema.questions.id, "mcq-question")).get()?.status).toBe("generated");
  });

  it("does not allow mutations of another user's question", async () => {
    sharedDb.insert(schema.users).values({ id: "review-other-user", name: "Other", createdAt: new Date().toISOString() }).run();
    sharedDb.insert(schema.subjects).values({ id: "review-other-subject", userId: "review-other-user", name: "Other", color: "#000000", createdAt: new Date().toISOString() }).run();
    sharedDb.insert(schema.questions).values({
      id: "review-other-question", userId: "review-other-user", subjectId: "review-other-subject",
      type: "active_recall", prompt: "Private", answer: "Private", answerChoices: "[]",
      sourceExcerpt: "Private", status: "generated", source: "ai", createdAt: new Date().toISOString(),
    }).run();

    expect((await updateQuestion(patchRequest({ action: "approve" }), { params: { id: "review-other-question" } })).status).toBe(404);
    expect(sharedDb.select().from(schema.questions).where(eq(schema.questions.id, "review-other-question")).get()?.status).toBe("generated");
  });

  it("bulk approval is limited to current user subject and material scope", async () => {
    sharedDb.insert(schema.materials).values({ id: "bulk-mat-a", userId: SEED_USER_ID, subjectId: SEED_SUBJECT_ID, title: "A", content: "A", createdAt: new Date().toISOString() }).run();
    sharedDb.insert(schema.materials).values({ id: "bulk-mat-b", userId: SEED_USER_ID, subjectId: SEED_SUBJECT_ID, title: "B", content: "B", createdAt: new Date().toISOString() }).run();
    for (const [id, materialId, status] of [["bulk-a", "bulk-mat-a", "generated"], ["bulk-b", "bulk-mat-b", "edited"], ["bulk-rejected", "bulk-mat-a", "rejected"]] as const) {
      sharedDb.insert(schema.questions).values({ id, userId: SEED_USER_ID, subjectId: SEED_SUBJECT_ID, materialId, type: "active_recall", prompt: id, answer: id, answerChoices: "[]", sourceExcerpt: id, status, source: "ai", createdAt: new Date().toISOString() }).run();
    }
    const res = await bulkApprove(patchRequest({ subjectId: SEED_SUBJECT_ID, materialId: "bulk-mat-a" }));
    expect(await jsonBody<{ approved: number }>(res)).toEqual({ approved: 1 });
    expect(sharedDb.select().from(schema.questions).where(eq(schema.questions.id, "bulk-a")).get()?.status).toBe("approved");
    expect(sharedDb.select().from(schema.questions).where(eq(schema.questions.id, "bulk-b")).get()?.status).toBe("edited");
    expect(sharedDb.select().from(schema.questions).where(eq(schema.questions.id, "bulk-rejected")).get()?.status).toBe("rejected");
  });
});
