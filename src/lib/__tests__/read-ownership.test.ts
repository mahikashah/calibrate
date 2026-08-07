/**
 * Guards the question and material GET (list) endpoints against cross-user
 * data exposure.
 *
 * Ownership rules under test:
 *   1. GET /api/questions returns only the authenticated user's questions.
 *   2. GET /api/materials returns only the authenticated user's materials.
 *   3. Rows owned by a different user are absent from each response even
 *      when they exist in the database.
 */

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
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

  // Seed both users.
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
const { GET: getQuestions } = await import("@/app/api/questions/route");
const { GET: getMaterials } = await import("@/app/api/materials/route");

// ---------------------------------------------------------------------------
// Schema helpers
// ---------------------------------------------------------------------------
import * as schema from "../db/schema";

function makeGetRequest(path: string): Request {
  return new Request(`http://localhost${path}`, { method: "GET" });
}

function seedSubject(id: string, userId: string) {
  sharedDb
    .insert(schema.subjects)
    .values({ id, userId, name: "Subj", color: "#6366f1", createdAt: new Date().toISOString() })
    .run();
}

function seedQuestion(id: string, userId: string, subjectId: string) {
  sharedDb
    .insert(schema.questions)
    .values({
      id,
      userId,
      subjectId,
      materialId: null,
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
// Tests: GET /api/questions
// ---------------------------------------------------------------------------
describe("GET /api/questions — read isolation", () => {
  beforeEach(() => {
    clearAll();
    activeUserId = OWNER_ID;
    seedSubject("sub1", OWNER_ID);
    seedSubject("sub2", OTHER_ID);
  });

  it("returns only the authenticated user's questions", async () => {
    seedQuestion("q-mine", OWNER_ID, "sub1");
    seedQuestion("q-theirs", OTHER_ID, "sub2");

    activeUserId = OWNER_ID;
    const res = await getQuestions(makeGetRequest("/api/questions"));

    expect(res.status).toBe(200);
    const body = await res.json();
    const ids: string[] = body.map((r: { id: string }) => r.id);

    expect(ids).toContain("q-mine");
    expect(ids).not.toContain("q-theirs");
  });

  it("returns an empty list when the authenticated user has no questions", async () => {
    seedQuestion("q-theirs", OTHER_ID, "sub2");

    activeUserId = OWNER_ID;
    const res = await getQuestions(makeGetRequest("/api/questions"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(0);
  });

  it("does not expose another user's questions when both have rows", async () => {
    seedQuestion("q-mine-1", OWNER_ID, "sub1");
    seedQuestion("q-mine-2", OWNER_ID, "sub1");
    seedQuestion("q-theirs-1", OTHER_ID, "sub2");
    seedQuestion("q-theirs-2", OTHER_ID, "sub2");

    activeUserId = OWNER_ID;
    const res = await getQuestions(makeGetRequest("/api/questions"));

    expect(res.status).toBe(200);
    const body = await res.json();
    const ids: string[] = body.map((r: { id: string }) => r.id);

    expect(ids).toHaveLength(2);
    expect(ids).toContain("q-mine-1");
    expect(ids).toContain("q-mine-2");
    expect(ids).not.toContain("q-theirs-1");
    expect(ids).not.toContain("q-theirs-2");
  });
});

// ---------------------------------------------------------------------------
// Tests: GET /api/materials
// ---------------------------------------------------------------------------
describe("GET /api/materials — read isolation", () => {
  beforeEach(() => {
    clearAll();
    activeUserId = OWNER_ID;
    seedSubject("sub1", OWNER_ID);
    seedSubject("sub2", OTHER_ID);
  });

  it("returns only the authenticated user's materials", async () => {
    seedMaterial("mat-mine", OWNER_ID, "sub1");
    seedMaterial("mat-theirs", OTHER_ID, "sub2");

    activeUserId = OWNER_ID;
    const res = await getMaterials(makeGetRequest("/api/materials"));

    expect(res.status).toBe(200);
    const body = await res.json();
    const ids: string[] = body.map((r: { id: string }) => r.id);

    expect(ids).toContain("mat-mine");
    expect(ids).not.toContain("mat-theirs");
  });

  it("returns an empty list when the authenticated user has no materials", async () => {
    seedMaterial("mat-theirs", OTHER_ID, "sub2");

    activeUserId = OWNER_ID;
    const res = await getMaterials(makeGetRequest("/api/materials"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(0);
  });

  it("does not expose another user's materials when both have rows", async () => {
    seedMaterial("mat-mine-1", OWNER_ID, "sub1");
    seedMaterial("mat-mine-2", OWNER_ID, "sub1");
    seedMaterial("mat-theirs-1", OTHER_ID, "sub2");
    seedMaterial("mat-theirs-2", OTHER_ID, "sub2");

    activeUserId = OWNER_ID;
    const res = await getMaterials(makeGetRequest("/api/materials"));

    expect(res.status).toBe(200);
    const body = await res.json();
    const ids: string[] = body.map((r: { id: string }) => r.id);

    expect(ids).toHaveLength(2);
    expect(ids).toContain("mat-mine-1");
    expect(ids).toContain("mat-mine-2");
    expect(ids).not.toContain("mat-theirs-1");
    expect(ids).not.toContain("mat-theirs-2");
  });
});
