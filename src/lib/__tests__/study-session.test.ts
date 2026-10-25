import { describe, expect, it } from "vitest";
import { isSimpleAnswerCorrect, isValidMcq, parseAnswerChoices } from "../study-session";

describe("study-session helpers", () => {
  it("grades MCQ and fill-in answers with normalized whitespace and capitalization", () => {
    expect(isSimpleAnswerCorrect("  Cellular   Respiration ", "cellular respiration")).toBe(true);
    expect(isSimpleAnswerCorrect("photosynthesis", "respiration")).toBe(false);
  });

  it("returns valid stored answer choices and ignores malformed values", () => {
    expect(parseAnswerChoices('["A", "B", "C", "D"]')).toEqual(["A", "B", "C", "D"]);
    expect(parseAnswerChoices("not json")).toEqual([]);
    expect(parseAnswerChoices('["A", 2]')).toEqual([]);
  });

  it("requires four distinct nonblank MCQ choices including the keyed answer", () => {
    expect(isValidMcq("A", ["A", "B", "C", "D"])).toBe(true);
    expect(isValidMcq("A", ["A", "A", "C", "D"])).toBe(false);
    expect(isValidMcq("A", ["A", "", "C", "D"])).toBe(false);
    expect(isValidMcq("Missing", ["A", "B", "C", "D"])).toBe(false);
  });
});