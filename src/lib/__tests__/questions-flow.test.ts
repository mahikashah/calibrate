/**
 * These tests guard the two-step persistence flow that the Question Bank
 * depends on:
 *
 *   1. Each notes submission creates a distinct `materials` row first.
 *   2. Generated questions are saved with that material's ID so they stay
 *      linked after a page refresh.
 *   3. The user-selected `count` is forwarded to the generation call, not
 *      silently replaced with a hard-coded default.
 *
 * The suite uses an in-memory SQLite database (same schema as production) so
 * the route handlers run their real insert/select logic without touching the
 * dev database file.
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
// Drizzle schema.  The factory is async so Vitest can properly await imports.
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
      source TEXT NOT NULL DEFAULT 'ai',
      created_at TEXT NOT NULL
    );
  `);

  const db = drizzle(sqlite, { schema });
  sharedDb = db;

  // Seed the one user and one subject every test depends on.
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

// Replace NextResponse with a plain Response so the route handlers work
// outside the Next.js runtime.
vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(data), {
        ...(init ?? {}),
        headers: { "content-type": "application/json" },
      }),
  },
}));

// Always use the offline MockProvider — fast, deterministic, no API key.
vi.mock("@/lib/llm", async () => {
  const { MockProvider } = await import("../llm/mock");
  const mock = new MockProvider();
  return {
    withFallback: async <T>(fn: (p: typeof mock) => Promise<T>) => ({
      result: await fn(mock),
      provider: "mock",
      fellBack: false,
    }),
  };
});

// ---------------------------------------------------------------------------
// Route handlers (imported after mocks are registered)
// ---------------------------------------------------------------------------
const { POST: createMaterial } = await import("@/app/api/materials/route");
const { POST: generateQuestions } = await import("@/app/api/questions/generate/route");
const { GET: listQuestions } = await import("@/app/api/questions/route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
import * as schema from "../db/schema";

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

async function jsonBody<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Question-Bank persistence flow", () => {
  beforeEach(clearGeneratedRows);

  it("notes submission creates a material row before generation proceeds", async () => {
    // Step 1 — the UI calls POST /api/materials to persist the notes first.
    const matRes = await createMaterial(
      postRequest({
        subjectId: SEED_SUBJECT_ID,
        title: "Week 1 notes",
        content: "Photosynthesis converts sunlight into chemical energy stored in glucose.",
      }),
    );

    expect(matRes.status).toBe(201);
    const material = await jsonBody<{ id: string; title: string }>(matRes);

    // A real ID must be returned before any generation attempt.
    expect(material.id).toBeTruthy();
    expect(material.title).toBe("Week 1 notes");

    // Verify the row actually landed in the database.
    const saved = sharedDb
      .select()
      .from(schema.materials)
      .where(eq(schema.materials.id, material.id))
      .get();
    expect(saved).toBeDefined();
    expect(saved?.content).toContain("Photosynthesis");
  });

  it("generated questions retain the material link and are returned by a subsequent list request", async () => {
    // Step 1 — create the material (mirrors what the UI does first).
    const matRes = await createMaterial(
      postRequest({
        subjectId: SEED_SUBJECT_ID,
        title: "Cell biology",
        content:
          "The mitochondria is the powerhouse of the cell. It produces ATP through cellular respiration.",
      }),
    );
    const { id: materialId } = await jsonBody<{ id: string }>(matRes);

    // Step 2 — generate questions tied to that material.
    const genRes = await generateQuestions(
      postRequest({
        subjectId: SEED_SUBJECT_ID,
        subjectName: "Science",
        materialId,
        count: 3,
      }),
    );

    expect(genRes.status).toBe(201);
    const { questions: generated } = await jsonBody<{
      questions: Array<{ id: string; materialId: string | null }>;
    }>(genRes);

    expect(generated.length).toBeGreaterThan(0);

    // Every generated question must reference the material that was just created.
    for (const q of generated) {
      expect(q.materialId).toBe(materialId);
    }

    // Step 3 — simulate a page refresh: fetch all questions via GET.
    const listRes = await listQuestions(new Request("http://localhost/api/questions"));
    const persisted = await jsonBody<Array<{ id: string; materialId: string | null }>>(listRes);

    // All persisted questions for this generation retain the correct materialId.
    const generatedIds = new Set(generated.map((q) => q.id));
    for (const q of persisted.filter((q) => generatedIds.has(q.id))) {
      expect(q.materialId).toBe(materialId);
    }
  });

  it("passes the user-selected question count to the generation call", async () => {
    // Helper: create a material and generate questions with the given count.
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
      "The third law states every action has an equal and opposite reaction. " +
      "These three laws form the foundation of classical mechanics.";

    const twoQuestions = await generateWithCount(longContent, 2);
    expect(twoQuestions).toHaveLength(2);

    const fourQuestions = await generateWithCount(longContent, 4);
    expect(fourQuestions).toHaveLength(4);
  });

  it("generate route returns 422 when count is 0", async () => {
    const res = await generateQuestions(
      postRequest({
        subjectId: SEED_SUBJECT_ID,
        materialText: "Some content.",
        count: 0,
      }),
    );
    expect(res.status).toBe(422);
  });

  it("generate route returns 422 when count exceeds 15", async () => {
    const res = await generateQuestions(
      postRequest({
        subjectId: SEED_SUBJECT_ID,
        materialText: "Some content.",
        count: 16,
      }),
    );
    expect(res.status).toBe(422);
  });

  it("materials route rejects an empty title", async () => {
    const res = await createMaterial(
      postRequest({
        subjectId: SEED_SUBJECT_ID,
        title: "",
        content: "Some valid content.",
      }),
    );
    expect(res.status).toBe(422);
  });

  it("materials route rejects empty content", async () => {
    const res = await createMaterial(
      postRequest({
        subjectId: SEED_SUBJECT_ID,
        title: "Valid title",
        content: "",
      }),
    );
    expect(res.status).toBe(422);
  });

  it("generate route returns 404 when materialId references a non-existent row", async () => {
    const res = await generateQuestions(
      postRequest({
        subjectId: SEED_SUBJECT_ID,
        materialId: "mat_does_not_exist",
        count: 3,
      }),
    );
    expect(res.status).toBe(404);
  });

  it("generate route returns 404 when subjectId references a non-existent row", async () => {
    const res = await generateQuestions(
      postRequest({
        subjectId: "sub_does_not_exist",
        materialText: "Some content.",
        count: 3,
      }),
    );
    expect(res.status).toBe(404);
  });

  it("generate route returns 404 when subjectId belongs to a different user", async () => {
    // Seed a subject owned by a different user.
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

    // The current user (SEED_USER_ID) tries to generate questions under the
    // other user's subject — must be rejected with 404.
    const res = await generateQuestions(
      postRequest({
        subjectId: OTHER_SUBJECT_ID,
        materialText: "Some content.",
        count: 3,
      }),
    );
    expect(res.status).toBe(404);
  });

  it("generate route returns 422 when subjectId is missing", async () => {
    const res = await generateQuestions(
      postRequest({
        materialText: "Some content.",
        count: 3,
      }),
    );
    expect(res.status).toBe(422);
  });

  it("generate route returns 422 when subjectId is blank", async () => {
    const res = await generateQuestions(
      postRequest({
        subjectId: "",
        materialText: "Some content.",
        count: 3,
      }),
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
    // Seed a subject owned by a different user.
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

    // The current user (SEED_USER_ID) tries to create a material under the
    // other user's subject — must be rejected with 404.
    const res = await createMaterial(
      postRequest({
        subjectId: OTHER_SUBJECT_ID,
        title: "Stolen notes",
        content: "Content that should be rejected.",
      }),
    );
    expect(res.status).toBe(404);
  });
});
