/**
 * Guards the subject DELETE route against orphaning linked questions or materials.
 *
 *   1. Deleting an empty subject succeeds (200).
 *   2. Deleting a subject that owns questions is blocked with 409.
 *   3. Deleting a subject that owns materials is blocked with 409.
 *   4. The subject is only removed from the database when the delete succeeds.
 */

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as DbSchema from "../db/schema";

// ---------------------------------------------------------------------------
// Shared in-memory database
// ---------------------------------------------------------------------------
let sharedDb: BetterSQLite3Database<typeof DbSchema>;
const SEED_USER_ID = "test-user";

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

  db.insert(schema.users)
    .values({ id: SEED_USER_ID, name: "Test", createdAt: new Date().toISOString() })
    .run();

  return { db };
});

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

// ---------------------------------------------------------------------------
// Route handler (imported after mocks)
// ---------------------------------------------------------------------------
const { DELETE: deleteSubject } = await import("@/app/api/subjects/[id]/route");

// ---------------------------------------------------------------------------
// Schema helpers
// ---------------------------------------------------------------------------
import * as schema from "../db/schema";

function makeDeleteRequest(id: string): Request {
  return new Request(`http://localhost/api/subjects/${id}`, { method: "DELETE" });
}

function seedSubject(id: string) {
  sharedDb
    .insert(schema.subjects)
    .values({ id, userId: SEED_USER_ID, name: "Test Subject", color: "#6366f1", createdAt: new Date().toISOString() })
    .run();
}

function seedQuestion(id: string, subjectId: string) {
  sharedDb
    .insert(schema.questions)
    .values({
      id,
      userId: SEED_USER_ID,
      subjectId,
      prompt: "What is X?",
      answer: "X is Y.",
      type: "recall",
      source: "user",
      createdAt: new Date().toISOString(),
    })
    .run();
}

function seedMaterial(id: string, subjectId: string) {
  sharedDb
    .insert(schema.materials)
    .values({
      id,
      userId: SEED_USER_ID,
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
// Tests
// ---------------------------------------------------------------------------
describe("DELETE /api/subjects/[id]", () => {
  beforeEach(clearAll);

  it("deletes an empty subject and returns 200", async () => {
    seedSubject("sub-empty");
    const res = await deleteSubject(makeDeleteRequest("sub-empty"), {
      params: { id: "sub-empty" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("sub-empty");

    // Row must be gone from the database.
    const row = sharedDb.select().from(schema.subjects).where(eq(schema.subjects.id, "sub-empty")).get();
    expect(row).toBeUndefined();
  });

  it("blocks deletion with 409 when the subject owns questions", async () => {
    seedSubject("sub-with-q");
    seedQuestion("q1", "sub-with-q");

    const res = await deleteSubject(makeDeleteRequest("sub-with-q"), {
      params: { id: "sub-with-q" },
    });
    expect(res.status).toBe(409);

    const body = await res.json();
    expect(body.error).toMatch(/question/i);

    // Subject must still exist.
    const row = sharedDb.select().from(schema.subjects).where(eq(schema.subjects.id, "sub-with-q")).get();
    expect(row).toBeDefined();
  });

  it("blocks deletion with 409 when the subject owns materials", async () => {
    seedSubject("sub-with-m");
    seedMaterial("mat1", "sub-with-m");

    const res = await deleteSubject(makeDeleteRequest("sub-with-m"), {
      params: { id: "sub-with-m" },
    });
    expect(res.status).toBe(409);

    const body = await res.json();
    expect(body.error).toMatch(/material/i);

    // Subject must still exist.
    const row = sharedDb.select().from(schema.subjects).where(eq(schema.subjects.id, "sub-with-m")).get();
    expect(row).toBeDefined();
  });

  it("returns 404 for an unknown subject ID", async () => {
    const res = await deleteSubject(makeDeleteRequest("no-such-id"), {
      params: { id: "no-such-id" },
    });
    expect(res.status).toBe(404);
  });
});
