import { describe, expect, it } from "vitest";
import { TECHNIQUES } from "../techniques";
import { techniqueGuidance } from "../technique-guidance";

describe("technique guidance for Study", () => {
  it("covers every catalog technique with clickable how-to content", () => {
    for (const technique of TECHNIQUES) {
      const guide = techniqueGuidance(technique.id);
      expect(guide.id).toBe(technique.id);
      expect(guide.label).toBe(technique.label);
      expect(guide.shortDescription.length).toBeGreaterThan(20);
      expect(guide.howTo.length).toBeGreaterThanOrEqual(3);
      expect(guide.measures.length).toBeGreaterThan(20);
      expect(guide.sessionWorks.length).toBeGreaterThan(20);
    }
  });

  it("does not claim automated essay grading for Feynman", () => {
    const guide = techniqueGuidance("feynman");
    expect(guide.howTo.join(" ").toLowerCase()).toMatch(/self-check|does not auto-grade/);
  });

  it("states that re-reading is measured by the outcome check, not reading time", () => {
    const guide = techniqueGuidance("rereading");
    expect(guide.measures.toLowerCase()).toMatch(/outcome check/);
    expect(guide.measures.toLowerCase()).toMatch(/context|not/);
  });

  it("is honest that spaced repetition scheduling is not automated yet", () => {
    const guide = techniqueGuidance("spaced_repetition");
    expect(guide.howTo.join(" ").toLowerCase()).toMatch(/not schedule|not automated/);
  });
});
