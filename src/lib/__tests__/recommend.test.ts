import { describe, expect, it } from "vitest";
import { computeInsights } from "../recommend";
import { makeRecords, makeRng } from "./helpers";

/**
 * These tests encode, as runnable checks, the exact confidence-tier lessons the
 * white paper describes in §9.1. The recommendation engine is where the
 * product's integrity lives: it must refuse to over-claim on thin or noisy data.
 */

describe("confidence tiers — the boundaries that keep the engine honest", () => {
  it("declares GATHERING DATA when the leader has fewer than three sessions", () => {
    // A high average means nothing with two data points behind it.
    const records = makeRecords({ subject: "S", technique: "active_recall", base: 90, n: 2 });
    const { subjects } = computeInsights(records);

    expect(subjects[0].confidence).toBe("insufficient");
    expect(subjects[0].headline).toMatch(/not enough data/i);
  });

  it("declares a CLEAR signal for a wide, well-separated gap with enough sessions", () => {
    const rng = makeRng(101);
    const records = [
      ...makeRecords({ subject: "S", technique: "active_recall", base: 86, n: 6, jitter: 4, rng }),
      ...makeRecords({ subject: "S", technique: "rereading", base: 58, n: 5, jitter: 4, rng }),
    ];
    const { subjects } = computeInsights(records);

    expect(subjects[0].confidence).toBe("clear");
    expect(subjects[0].best?.technique).toBe("active_recall");
    expect(subjects[0].headline).toMatch(/clearly working best/i);
  });

  it("stays EMERGING for a small gap (the app must not over-claim)", () => {
    const rng = makeRng(7);
    const records = [
      ...makeRecords({ subject: "S", technique: "active_recall", base: 79, n: 5, jitter: 6, rng }),
      ...makeRecords({ subject: "S", technique: "feynman", base: 77, n: 5, jitter: 6, rng }),
    ];
    const { subjects } = computeInsights(records);

    expect(subjects[0].confidence).toBe("emerging");
    expect(subjects[0].confidence).not.toBe("clear");
  });

  it("withholds CLEAR when the runner-up has too few sessions to trust", () => {
    const rng = makeRng(202);
    const records = [
      ...makeRecords({ subject: "S", technique: "active_recall", base: 88, n: 6, jitter: 3, rng }),
      // Big apparent gap, but only two sessions behind the runner-up.
      ...makeRecords({ subject: "S", technique: "feynman", base: 60, n: 2, jitter: 3, rng }),
    ];
    const { subjects } = computeInsights(records);

    expect(subjects[0].best?.technique).toBe("active_recall");
    expect(subjects[0].confidence).not.toBe("clear");
    expect(subjects[0].confidence).toBe("emerging");
  });

  it("maps all-maximum inputs to an average outcome score of exactly 100", () => {
    const records = makeRecords({
      subject: "S",
      technique: "active_recall",
      base: 100,
      confidence: 5,
      n: 4,
    });
    const { subjects } = computeInsights(records);

    expect(subjects[0].techniques[0].avgScore).toBe(100);
  });
});

/**
 * The cautionary tale from §9.1, encoded. The whole lesson is that your test
 * data must carry realistic variance — because the thing under test is a machine
 * for reasoning about variance.
 */
describe("the zero-variance trap (white paper §9.1)", () => {
  it("reports CLEAR on a 2-point gap when variance is zero — this is correct, not a bug", () => {
    // Identical scores => confidence intervals collapse to zero width, so ANY
    // non-zero gap is perfectly separable. This is the statistics being honest.
    const records = [
      ...makeRecords({ subject: "S", technique: "active_recall", base: 79, n: 5, jitter: 0 }),
      ...makeRecords({ subject: "S", technique: "feynman", base: 77, n: 5, jitter: 0 }),
    ];
    const { subjects } = computeInsights(records);

    expect(subjects[0].techniques[0].ci).toBe(0); // zero variance => zero-width CI
    expect(subjects[0].confidence).toBe("clear");
  });

  it("flips to EMERGING on the SAME gap once realistic variance is added", () => {
    const rng = makeRng(7);
    const records = [
      ...makeRecords({ subject: "S", technique: "active_recall", base: 79, n: 5, jitter: 6, rng }),
      ...makeRecords({ subject: "S", technique: "feynman", base: 77, n: 5, jitter: 6, rng }),
    ];
    const { subjects } = computeInsights(records);

    expect(subjects[0].techniques[0].ci).toBeGreaterThan(0);
    expect(subjects[0].confidence).toBe("emerging");
  });
});

describe("report structure", () => {
  it("orders subjects by how much evidence backs them", () => {
    const records = [
      ...makeRecords({ subject: "Light", technique: "active_recall", base: 80, n: 3 }),
      ...makeRecords({ subject: "Heavy", technique: "active_recall", base: 80, n: 8 }),
    ];
    const { subjects } = computeInsights(records);
    expect(subjects.map((s) => s.subjectName)).toEqual(["Heavy", "Light"]);
  });

  it("only crowns an overall best technique once it has at least three sessions", () => {
    const records = [
      // rereading looks amazing but has just two sessions -> must be ignored overall.
      ...makeRecords({ subject: "S", technique: "rereading", base: 99, n: 2 }),
      ...makeRecords({ subject: "S", technique: "active_recall", base: 82, n: 5 }),
    ];
    const { overall } = computeInsights(records);
    expect(overall.bestOverallTechnique).toBe("Active recall");
  });
});
