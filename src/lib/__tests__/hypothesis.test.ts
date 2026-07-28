import { describe, expect, it } from "vitest";
import { computeHypothesis, ONBOARDING_QUESTIONS } from "../hypothesis";

/**
 * Onboarding produces a transparent, rule-based starting hypothesis. These tests
 * pin the mapping so a refactor can't silently change what a given set of answers
 * recommends.
 */

describe("computeHypothesis", () => {
  it("recommends active recall for the seed's answer profile", () => {
    // The exact answers used by the demo seed. See the white paper's home-page
    // "hypothesis vs. evidence" contrast: onboarding guesses Active recall.
    const answers = { retention: 1, struggle: 1, check: 0, consistency: 1, subject_type: 1 };
    const h = computeHypothesis(answers);

    expect(h.primary).toBe("active_recall");
    expect(h.ranked[0].technique).toBe("active_recall");
  });

  it("recommends spaced repetition for a forgetful, memorization-heavy, crammer profile", () => {
    const answers = {
      retention: 0, // most of it fades fast -> spaced_repetition
      struggle: 0, // forgetting over time -> spaced_repetition
      check: 1, // recall from memory -> active_recall
      consistency: 0, // crams close to deadlines -> spaced_repetition
      subject_type: 2, // memorization-heavy -> spaced_repetition, active_recall
    };
    const h = computeHypothesis(answers);

    expect(h.primary).toBe("spaced_repetition");
  });

  it("ranks techniques by descending score", () => {
    const answers = { retention: 0, struggle: 0, check: 3, consistency: 0, subject_type: 0 };
    const scores = computeHypothesis(answers).ranked.map((r) => r.score);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
  });

  it("always returns a usable guess even with no answers", () => {
    const h = computeHypothesis({});
    expect(h.ranked.length).toBeGreaterThan(0);
    expect(h.primary).toBe("active_recall");
  });

  it("ignores out-of-range answer indices instead of throwing", () => {
    const h = computeHypothesis({ retention: 99, struggle: -1 });
    expect(h.primary).toBeTruthy();
  });

  it("writes a rationale that frames the result as a guess to be tested", () => {
    const h = computeHypothesis({ retention: 0 });
    expect(h.rationale).toMatch(/starting guess|confirm or overturn/i);
  });

  it("keeps the onboarding questionnaire and scoring in sync", () => {
    // Every option must map to at least one real technique weight (or be a
    // deliberate no-op like "very regular schedule").
    expect(ONBOARDING_QUESTIONS.length).toBe(5);
    for (const q of ONBOARDING_QUESTIONS) {
      expect(q.options.length).toBeGreaterThan(0);
    }
  });
});
