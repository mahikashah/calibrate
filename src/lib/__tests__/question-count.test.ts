import { describe, expect, it } from "vitest";
import {
  QUESTION_COUNT_DEFAULT,
  parseQuestionCount,
  shortfallCopy,
} from "../question-count";

describe("question count target rules", () => {
  it("defaults to 6 when count is missing", () => {
    expect(parseQuestionCount(undefined)).toEqual({
      ok: true,
      count: QUESTION_COUNT_DEFAULT,
      usedDefault: true,
    });
    expect(parseQuestionCount(null)).toEqual({
      ok: true,
      count: QUESTION_COUNT_DEFAULT,
      usedDefault: true,
    });
    expect(parseQuestionCount("")).toEqual({
      ok: true,
      count: QUESTION_COUNT_DEFAULT,
      usedDefault: true,
    });
  });

  it("keeps an explicit valid target of 8", () => {
    expect(parseQuestionCount(8)).toEqual({ ok: true, count: 8, usedDefault: false });
    expect(parseQuestionCount("8")).toEqual({ ok: true, count: 8, usedDefault: false });
  });

  it("rejects invalid explicit counts instead of silently coercing to 6", () => {
    expect(parseQuestionCount(0).ok).toBe(false);
    expect(parseQuestionCount(-1).ok).toBe(false);
    expect(parseQuestionCount(11).ok).toBe(false);
    expect(parseQuestionCount("abc").ok).toBe(false);
    expect(parseQuestionCount("8.5").ok).toBe(false);
  });

  it("explains shortfalls when actual is below requested", () => {
    expect(shortfallCopy(8, 5)).toMatch(/5 grounded questions/);
    expect(shortfallCopy(8, 5)).toMatch(/all 8/);
    expect(shortfallCopy(8, 8)).toBeNull();
    expect(shortfallCopy(8, 0)).toBeNull();
  });
});
