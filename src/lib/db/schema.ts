import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Data model for Calibrate.
 *
 * The whole app is single-user and local-first: one row in `users` acts as the
 * owner of everything. Auth is intentionally out of scope for the MVP. All
 * timestamps are stored as ISO-8601 text so the SQLite file is human-readable.
 */

const now = () => new Date().toISOString();

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(now),
});

export const subjects = sqliteTable("subjects", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  createdAt: text("created_at").notNull().$defaultFn(now),
});

export const materials = sqliteTable("materials", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  subjectId: text("subject_id")
    .notNull()
    .references(() => subjects.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(now),
});

/**
 * type: active_recall | mcq | feynman | fill_in_blank  (FastAPI types)
 *       recall | practice | cloze  (legacy mock-provider types — kept for
 *       backward compatibility with existing rows)
 * status: generated | approved | edited | rejected (review lifecycle)
 * answerChoices: JSON-encoded string[] — populated for MCQ, "[]" otherwise
 * sourceExcerpt: verbatim excerpt from the source material
 * source: ai | user
 */
export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  subjectId: text("subject_id")
    .notNull()
    .references(() => subjects.id),
  materialId: text("material_id").references(() => materials.id, {
    onDelete: "set null",
  }),
  type: text("type").notNull().default("recall"),
  prompt: text("prompt").notNull(),
  answer: text("answer").notNull().default(""),
  answerChoices: text("answer_choices"),
  sourceExcerpt: text("source_excerpt"),
  status: text("status").notNull().default("generated"),
  source: text("source").notNull().default("ai"),
  createdAt: text("created_at").notNull().$defaultFn(now),
});

/** technique: active_recall | spaced_repetition | feynman | practice_questions | rereading */
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  subjectId: text("subject_id")
    .notNull()
    .references(() => subjects.id),
  technique: text("technique").notNull(),
  materialId: text("material_id").references(() => materials.id),
  plannedMinutes: integer("planned_minutes").notNull().default(25),
  actualMinutes: integer("actual_minutes").notNull().default(0),
  notes: text("notes").notNull().default(""),
  completionKey: text("completion_key").unique(),
  startedAt: text("started_at").notNull().$defaultFn(now),
  endedAt: text("ended_at"),
});

/**
 * The "quick outcome check" a student takes right after a session and again on
 * later review. These rows are the raw evidence the recommendation engine reads.
 *   quizScore  : 0..100  objective score on a short check
 *   confidence : 1..5    subjective "how well do I know this now"
 *   recall     : 0..100  % of key ideas recalled unaided
 */
export const outcomes = sqliteTable("outcomes", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id),
  quizScore: real("quiz_score").notNull(),
  confidence: integer("confidence").notNull(),
  recall: real("recall").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().$defaultFn(now),
});

/**
 * Post-session contextual feedback — separate from objective session/outcome data.
 * One record per completed session (sessionId is UNIQUE).
 * Submitting feedback again upserts rather than duplicating evidence.
 *
 * overall   : "rough" | "good"     — student's overall experience
 * calmWired : 0..100               — 0 = Calm, 100 = Wired (anxiety/focus slider)
 * reasons   : JSON string[]        — structured cause values when session felt rough
 *             possible values: technique_wrong | questions_wrong | material_hard |
 *                              distracted_low_energy | not_sure
 *
 * Does NOT duplicate: score, correctness, elapsed time, technique, subject.
 * Those live in sessions / outcomes and remain objective.
 */
export const sessionFeedback = sqliteTable("session_feedback", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .unique()
    .references(() => sessions.id),
  overall: text("overall").notNull(), // "rough" | "good"
  calmWired: integer("calm_wired").notNull().default(50),
  reasons: text("reasons").notNull().default("[]"), // JSON-encoded string[]
  createdAt: text("created_at").notNull().$defaultFn(now),
});

/** One row per completed onboarding. `answers` and `hypothesis` are JSON blobs. */
export const onboarding = sqliteTable("onboarding", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  answers: text("answers").notNull(),
  hypothesis: text("hypothesis").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export type User = typeof users.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type Material = typeof materials.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Outcome = typeof outcomes.$inferSelect;
export type Onboarding = typeof onboarding.$inferSelect;
