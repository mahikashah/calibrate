/**
 * Per-user daily cap on AI question generation, plus a log of every attempt.
 *
 * Why: the FastAPI service calls a paid Hugging Face endpoint and the cost is
 * driven by how often students press "Generate". The cap is a rolling 24 hours
 * (not a calendar day) so there is no midnight reset to game.
 *
 * Attempts that fail before reaching the model (unreachable service, scanned
 * PDF, notes too long) cost nothing, so they do not count against the cap.
 */
import { and, count, eq, gte, isNull, notInArray, or } from "drizzle-orm";
import { db } from "./db";
import { generationEvents } from "./db/schema";
import { newId } from "./ids";

export const DEFAULT_DAILY_GENERATION_LIMIT = 15;

/** Error codes for attempts that never reached the model. */
export const NON_BILLABLE_ERROR_CODES = [
  "ML_SERVICE_UNAVAILABLE",
  "UNSUPPORTED_PDF",
  "PDF_PARSE_FAILED",
  "NOTES_TOO_LONG",
] as const;

export type GenerationKind = "notes" | "pdf";

/** GENERATIONS_PER_DAY, falling back to the default when unset or invalid. */
export function dailyGenerationLimit(
  env: Record<string, string | undefined> = process.env,
): number {
  const parsed = Number.parseInt(env.GENERATIONS_PER_DAY ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_GENERATION_LIMIT;
}

export function capMessage(limit: number): string {
  return `You've used all ${limit} of today's question generations. Your limit refreshes on a rolling 24-hour basis, so please try again a little later.`;
}

export interface CapStatus {
  allowed: boolean;
  used: number;
  limit: number;
}

export async function checkGenerationCap(
  userId: string,
  nowMs: number = Date.now(),
): Promise<CapStatus> {
  const limit = dailyGenerationLimit();
  const since = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
  const row = await db
    .select({ n: count() })
    .from(generationEvents)
    .where(
      and(
        eq(generationEvents.userId, userId),
        gte(generationEvents.createdAt, since),
        or(
          eq(generationEvents.ok, true),
          isNull(generationEvents.errorCode),
          notInArray(generationEvents.errorCode, [...NON_BILLABLE_ERROR_CODES]),
        ),
      ),
    )
    .get();
  const used = row?.n ?? 0;
  return { allowed: used < limit, used, limit };
}

export async function recordGeneration(entry: {
  userId: string;
  kind: GenerationKind;
  ok: boolean;
  errorCode?: string | null;
  questionCount?: number;
}): Promise<void> {
  try {
    await db
      .insert(generationEvents)
      .values({
        id: newId("gen"),
        userId: entry.userId,
        kind: entry.kind,
        ok: entry.ok,
        errorCode: entry.ok ? null : (entry.errorCode ?? "UNEXPECTED"),
        questionCount: entry.questionCount ?? 0,
        createdAt: new Date().toISOString(),
      })
      .run();
  } catch (err) {
    // Logging must never break a student's generation.
    console.error("[generation-cap] failed to record generation event:", err);
  }
}
