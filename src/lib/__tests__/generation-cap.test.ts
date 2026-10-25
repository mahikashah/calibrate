/**
 * Daily generation cap: helper behaviour plus the real /api/questions/generate
 * route (429 once the cap is reached, failures logged for metrics).
 */
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as DbSchema from "../db/schema";

let sharedDb: BetterSQLite3Database<typeof DbSchema>;
let activeUserId = "student-a";

vi.mock("@/lib/db", async () => {
  const BetterSqlite3 = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const schema = await import("../db/schema");
  const sqlite = new BetterSqlite3(":memory:");
  sqlite.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE, created_at TEXT NOT NULL);
    CREATE TABLE subjects (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE materials (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, subject_id TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE questions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, subject_id TEXT NOT NULL, material_id TEXT, type TEXT NOT NULL DEFAULT 'recall', prompt TEXT NOT NULL, answer TEXT NOT NULL DEFAULT '', answer_choices TEXT, source_excerpt TEXT, status TEXT NOT NULL DEFAULT 'generated', source TEXT NOT NULL DEFAULT 'ai', created_at TEXT NOT NULL);
    CREATE TABLE generation_events (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, ok INTEGER NOT NULL, error_code TEXT, question_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
  `);
  sharedDb = drizzle(sqlite, { schema });
  return { db: sharedDb };
});

vi.mock("@/lib/user", () => ({ currentUserId: () => activeUserId }));

vi.mock("@/lib/ml-service", async () => {
  const { MlServiceError } = await import("../ml-service");
  return {
    MlServiceError,
    generateQuestions: vi.fn(async ({ requestedCount }: { requestedCount: number }) =>
      Array.from({ length: requestedCount }, (_, i) => ({
        type: "active_recall" as const,
        question: `Q${i + 1}`,
        answer: `A${i + 1}`,
        answer_choices: [] as string[],
        source_excerpt: "excerpt",
      })),
    ),
    parsePdf: vi.fn(),
  };
});

const cap = await import("../generation-cap");
const { POST: generate } = await import("@/app/api/questions/generate/route");
const mlService = await import("@/lib/ml-service");
const { generationEvents, subjects, users, questions } = await import("../db/schema");

const HOUR = 60 * 60 * 1000;
const insertEvent = (
  userId: string,
  over: Partial<{ ok: boolean; errorCode: string | null; ageMs: number }> = {},
) =>
  sharedDb
    .insert(generationEvents)
    .values({
      id: `g_${Math.random().toString(36).slice(2)}`,
      userId,
      kind: "notes",
      ok: over.ok ?? true,
      errorCode: over.errorCode ?? null,
      questionCount: 0,
      createdAt: new Date(Date.now() - (over.ageMs ?? 0)).toISOString(),
    })
    .run();

const call = (subjectId = "sub-a") =>
  generate(
    new Request("http://localhost/api/questions/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subjectId, materialText: "Neurons transmit signals.", count: 3 }),
    }),
  );

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  activeUserId = "student-a";
  for (const t of [generationEvents, questions, subjects, users]) sharedDb.delete(t).run();
  const now = new Date().toISOString();
  for (const id of ["student-a", "student-b"]) {
    sharedDb.insert(users).values({ id, name: id, createdAt: now }).run();
    sharedDb
      .insert(subjects)
      .values({ id: id === "student-a" ? "sub-a" : "sub-b", userId: id, name: "Bio", color: "#000", createdAt: now })
      .run();
  }
});

describe("dailyGenerationLimit", () => {
  it("defaults to 15 and honours GENERATIONS_PER_DAY", () => {
    expect(cap.dailyGenerationLimit({})).toBe(15);
    expect(cap.dailyGenerationLimit({ GENERATIONS_PER_DAY: "4" })).toBe(4);
  });

  it("ignores invalid values", () => {
    for (const bad of ["", "abc", "0", "-3"]) {
      expect(cap.dailyGenerationLimit({ GENERATIONS_PER_DAY: bad })).toBe(15);
    }
  });
});

describe("checkGenerationCap", () => {
  it("counts only the user's own attempts in the last 24 hours", async () => {
    vi.stubEnv("GENERATIONS_PER_DAY", "3");
    await insertEvent("student-a");
    await insertEvent("student-a", { ageMs: 23 * HOUR });
    await insertEvent("student-a", { ageMs: 25 * HOUR }); // too old
    await insertEvent("student-b"); // someone else
    const status = await cap.checkGenerationCap("student-a");
    expect(status).toEqual({ allowed: true, used: 2, limit: 3 });
  });

  it("blocks at the limit", async () => {
    vi.stubEnv("GENERATIONS_PER_DAY", "2");
    await insertEvent("student-a");
    await insertEvent("student-a");
    expect((await cap.checkGenerationCap("student-a")).allowed).toBe(false);
    expect((await cap.checkGenerationCap("student-b")).allowed).toBe(true);
  });

  it("does not charge attempts that never reached the model", async () => {
    vi.stubEnv("GENERATIONS_PER_DAY", "2");
    for (const code of cap.NON_BILLABLE_ERROR_CODES) {
      await insertEvent("student-a", { ok: false, errorCode: code });
    }
    expect((await cap.checkGenerationCap("student-a")).used).toBe(0);
  });

  it("does charge model-side failures", async () => {
    await insertEvent("student-a", { ok: false, errorCode: "INVALID_MODEL_RESPONSE" });
    await insertEvent("student-a", { ok: false, errorCode: "MODEL_TIMEOUT" });
    expect((await cap.checkGenerationCap("student-a")).used).toBe(2);
  });
});

describe("POST /api/questions/generate with the cap", () => {
  it("returns 429 once the daily limit is reached, without calling the model", async () => {
    vi.stubEnv("GENERATIONS_PER_DAY", "2");
    expect((await call()).status).toBe(201);
    expect((await call()).status).toBe(201);
    const blocked = await call();
    expect(blocked.status).toBe(429);
    expect(((await blocked.json()) as { error: string }).error).toMatch(/all 2 of today's question generations/);
    expect(vi.mocked(mlService.generateQuestions)).toHaveBeenCalledTimes(2);
  });

  it("caps each student independently", async () => {
    vi.stubEnv("GENERATIONS_PER_DAY", "1");
    expect((await call()).status).toBe(201);
    expect((await call()).status).toBe(429);
    activeUserId = "student-b";
    expect((await call("sub-b")).status).toBe(201);
  });

  it("logs successes with the question count", async () => {
    await call();
    const rows = sharedDb.select().from(generationEvents).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: "student-a", kind: "notes", ok: true, errorCode: null, questionCount: 3 });
  });

  it("logs model failures (for metrics) and they count toward the cap", async () => {
    const { MlServiceError } = await import("../ml-service");
    vi.mocked(mlService.generateQuestions).mockRejectedValueOnce(
      new MlServiceError("INVALID_MODEL_RESPONSE", "bad json", "try again"),
    );
    expect((await call()).status).toBe(502);
    expect(sharedDb.select().from(generationEvents).all()[0]).toMatchObject({
      ok: false,
      errorCode: "INVALID_MODEL_RESPONSE",
    });
    expect((await cap.checkGenerationCap("student-a")).used).toBe(1);
  });

  it("does not charge the student when the ML service is unreachable", async () => {
    const { MlServiceError } = await import("../ml-service");
    vi.mocked(mlService.generateQuestions).mockRejectedValueOnce(
      new MlServiceError("ML_SERVICE_UNAVAILABLE", "down", "unavailable"),
    );
    expect((await call()).status).toBe(503);
    expect((await cap.checkGenerationCap("student-a")).used).toBe(0);
  });

  it("skips the cap and logging in explicit demo mode", async () => {
    vi.stubEnv("CALIBRATE_DEMO_MODE", "true");
    vi.stubEnv("GENERATIONS_PER_DAY", "1");
    expect((await call()).status).toBe(201);
    expect((await call()).status).toBe(201);
    expect(sharedDb.select().from(generationEvents).all()).toHaveLength(0);
  });
});
