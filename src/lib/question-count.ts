/** Shared product rule for question-generation targets. */
export const QUESTION_COUNT_MIN = 1;
export const QUESTION_COUNT_MAX = 10;
export const QUESTION_COUNT_DEFAULT = 6;

export type QuestionCountParse =
  | { ok: true; count: number; usedDefault: boolean }
  | { ok: false; error: string };

/**
 * Parse a generation target.
 * Missing / unspecified → default 6.
 * Explicit invalid values → error (do not silently coerce to 6).
 */
export function parseQuestionCount(value: unknown): QuestionCountParse {
  if (value === undefined || value === null || value === "") {
    return { ok: true, count: QUESTION_COUNT_DEFAULT, usedDefault: true };
  }
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < QUESTION_COUNT_MIN || value > QUESTION_COUNT_MAX) {
      return {
        ok: false,
        error: `Number of questions must be an integer from ${QUESTION_COUNT_MIN} to ${QUESTION_COUNT_MAX}.`,
      };
    }
    return { ok: true, count: value, usedDefault: false };
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return { ok: true, count: QUESTION_COUNT_DEFAULT, usedDefault: true };
    }
    if (!/^-?\d+$/.test(trimmed)) {
      return {
        ok: false,
        error: `Number of questions must be an integer from ${QUESTION_COUNT_MIN} to ${QUESTION_COUNT_MAX}.`,
      };
    }
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < QUESTION_COUNT_MIN || parsed > QUESTION_COUNT_MAX) {
      return {
        ok: false,
        error: `Number of questions must be an integer from ${QUESTION_COUNT_MIN} to ${QUESTION_COUNT_MAX}.`,
      };
    }
    return { ok: true, count: parsed, usedDefault: false };
  }
  return {
    ok: false,
    error: `Number of questions must be an integer from ${QUESTION_COUNT_MIN} to ${QUESTION_COUNT_MAX}.`,
  };
}

export function shortfallCopy(requested: number, actual: number): string | null {
  if (actual <= 0 || actual >= requested) return null;
  return `We generated ${actual} grounded question${actual === 1 ? "" : "s"} from this material. There wasn’t enough distinct source content for all ${requested}.`;
}
