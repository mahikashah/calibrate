/**
 * Guards the question and material DELETE routes against cross-user data deletion.
 *
 * Ownership rules under test:
 *   1. DELETE /api/questions/[id] returns 404 when the requester doesn't own the question.
 *   2. DELETE /api/questions/[id] returns 200 when the requester owns the question.
 *   3. DELETE /api/materials/[id] returns 404 when the requester doesn't own the material.
 *   4. DELETE /api/materials/[id] returns 200 when the requester owns the material, and
 *      cascades only the owner's linked questions.
 */

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as DbSchema from "../db/schema";

// ---------------------------------------------------------------------------
// Shared in-memory database
// ---------------------------------------------------------------------------
let sharedDb: BetterSQLite3Database<typeof DbSchema>;

const OWNER_ID = "owner-user";
const OTHER_ID = "other-user";

// currentUserId is writable so individual tests can switch the active session.
let activeUserId = OWNER_ID;

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

  // Seed both users so foreign-key style inserts won't fail.
  db.insert(schema.users)
    .values({ id: OWNER_ID, name: "Owner", createdAt: new Date().toISOString() })
    .run();
  db.insert(schema.users)
    .values({ id: OTHER_ID, name: "Other", createdAt: new Date().toISOString() })
    .run();

  return { db };
});

vi.mock("@/lib/user", () => ({
  currentUserId: () => activeUserId,
  DEFAULT_USER_ID: OWNER_ID,
  getCurrentUser: () => ({ id: activeUserId, name: "User", createdAt: new Date().toISOString() }),
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

// ---------------------------------------------------------------------------
// Route handlers (imported after mocks)
// ---------------------------------------------------------------------------
const { DELETE: deleteQuestion } = await import("@/app/api/questions/[id]/route");
const { DELETE: deleteMaterial } = await import("@/app/api/materials/[id]/route");

// ---------------------------------------------------------------------------
// Schema helpers
// ---------------------------------------------------------------------------
import * as schema from "../db/schema";

function makeRequest(path: string): Request {
  return new Request(`http://localhost${path}`, { method: "DELETE" });
}

function seedSubject(id: string, userId: string) {
  sharedDb
    .insert(schema.subjects)
    .values({ id, userId, name: "Subj", color: "#6366f1", createdAt: new Date().toISOString() })
    .run();
}

function seedQuestion(id: string, userId: string, subjectId: string, materialId?: string) {
  sharedDb
    .insert(schema.questions)
    .values({
      id,
      userId,
      subjectId,
      materialId: materialId ?? null,
      prompt: "What is X?",
      answer: "X is Y.",
      type: "recall",
      source: "user",
      createdAt: new Date().toISOString(),
    })
    .run();
}

function seedMaterial(id: string, userId: string, subjectId: string) {
  sharedDb
    .insert(schema.materials)
    .values({
      id,
      userId,
      subjectId,
      title: "Notes",
      content: "Some content.",
      createdAt: new Date().toISOString(),
    })
    .run();
}

function clearAll() {
  sharedDb.delete(schema.questions).run();
  sharedDb.delete(schema.materials).run();
  sharedDb.delete(schema.subjects).run();
}

// ---------------------------------------------------------------------------
// Tests: DELETE /api/questions/[id]
// ---------------------------------------------------------------------------
describe("DELETE /api/questions/[id] — ownership guard", () => {
  beforeEach(() => {
    clearAll();
    activeUserId = OWNER_ID;
    seedSubject("sub1", OWNER_ID);
    seedSubject("sub2", OTHER_ID);
  });

  it("returns 404 when a different user tries to delete the question", async () => {
    seedQuestion("q-owned-by-other", OTHER_ID, "sub2");

    // Authenticate as OWNER attempting to delete OTHER's question.
    activeUserId = OWNER_ID;
    const res = await deleteQuestion(makeRequest("/api/questions/q-owned-by-other"), {
      params: { id: "q-owned-by-other" },
    });

    expect(res.status).toBe(404);

    // The row must still exist in the database.
    const row = sharedDb
      .select()
      .from(schema.questions)
      .where(eq(schema.questions.id, "q-owned-by-other"))
      .get();
    expect(row).toBeDefined();
  });

  it("returns 200 when the authenticated user deletes their own question", async () => {
    seedQuestion("q-mine", OWNER_ID, "sub1");

    activeUserId = OWNER_ID;
    const res = await deleteQuestion(makeRequest("/api/questions/q-mine"), {
      params: { id: "q-mine" },
    });

    expect(res.status).toBe(200);

    // The row must be gone.
    const row = sharedDb
      .select()
      .from(schema.questions)
      .where(eq(schema.questions.id, "q-mine"))
      .get();
    expect(row).toBeUndefined();
  });

  it("returns 404 for a question ID that does not exist at all", async () => {
    activeUserId = OWNER_ID;
    const res = await deleteQuestion(makeRequest("/api/questions/no-such-q"), {
      params: { id: "no-such-q" },
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Tests: DELETE /api/materials/[id]
// ---------------------------------------------------------------------------
describe("DELETE /api/materials/[id] — ownership guard", () => {
  beforeEach(() => {
    clearAll();
    activeUserId = OWNER_ID;
    seedSubject("sub1", OWNER_ID);
    seedSubject("sub2", OTHER_ID);
  });

  it("returns 404 when a different user tries to delete the material", async () => {
    seedMaterial("mat-owned-by-other", OTHER_ID, "sub2");

    // Authenticate as OWNER attempting to delete OTHER's material.
    activeUserId = OWNER_ID;
    const res = await deleteMaterial(makeRequest("/api/materials/mat-owned-by-other"), {
      params: { id: "mat-owned-by-other" },
    });

    expect(res.status).toBe(404);

    // The row must still exist in the database.
    const row = sharedDb
      .select()
      .from(schema.materials)
      .where(eq(schema.materials.id, "mat-owned-by-other"))
      .get();
    expect(row).toBeDefined();
  });

  it("returns 200 when the authenticated user deletes their own material", async () => {
    seedMaterial("mat-mine", OWNER_ID, "sub1");

    activeUserId = OWNER_ID;
    const res = await deleteMaterial(makeRequest("/api/materials/mat-mine"), {
      params: { id: "mat-mine" },
    });

    expect(res.status).toBe(200);

    // The row must be gone.
    const row = sharedDb
      .select()
      .from(schema.materials)
      .where(eq(schema.materials.id, "mat-mine"))
      .get();
    expect(row).toBeUndefined();
  });

  it("only cascades the owner's linked questions, not another user's questions on the same material", async () => {
    // Scenario: two users both have questions linked to the same material ID
    // (edge case where material_id happens to match).  Deleting the material
    // must only remove the owner's questions.
    seedMaterial("mat-shared-id", OWNER_ID, "sub1");
    seedQuestion("q-owner-linked", OWNER_ID, "sub1", "mat-shared-id");
    // OTHER's question references the same material_id string but belongs to OTHER.
    seedQuestion("q-other-linked", OTHER_ID, "sub2", "mat-shared-id");

    activeUserId = OWNER_ID;
    const res = await deleteMaterial(makeRequest("/api/materials/mat-shared-id"), {
      params: { id: "mat-shared-id" },
    });

    expect(res.status).toBe(200);

    // Owner's question must be deleted.
    const ownerQ = sharedDb
      .select()
      .from(schema.questions)
      .where(eq(schema.questions.id, "q-owner-linked"))
      .get();
    expect(ownerQ).toBeUndefined();

    // Other user's question must be untouched.
    const otherQ = sharedDb
      .select()
      .from(schema.questions)
      .where(eq(schema.questions.id, "q-other-linked"))
      .get();
    expect(otherQ).toBeDefined();
  });

  it("returns 404 for a material ID that does not exist at all", async () => {
    activeUserId = OWNER_ID;
    const res = await deleteMaterial(makeRequest("/api/materials/no-such-mat"), {
      params: { id: "no-such-mat" },
    });
    expect(res.status).toBe(404);
  });
});
