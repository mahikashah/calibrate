import { describe, expect, it } from "vitest";
import { ci95, mean, outcomeScore, round1, stdDev, stdError, trend } from "../stats";

describe("mean", () => {
  it("returns 0 for an empty list", () => {
    expect(mean([])).toBe(0);
  });
  it("averages a list", () => {
    expect(mean([2, 4, 6])).toBe(4);
  });
});

describe("stdDev / stdError", () => {
  it("is 0 for fewer than two points", () => {
    expect(stdDev([])).toBe(0);
    expect(stdDev([5])).toBe(0);
    expect(stdError([5])).toBe(0);
  });
  it("uses the sample (n-1) variance", () => {
    // sample sd of [2,4,6] = sqrt(((−2)^2+0+2^2)/2) = sqrt(4) = 2
    expect(stdDev([2, 4, 6])).toBeCloseTo(2, 10);
    // standard error = sd / sqrt(n) = 2 / sqrt(3)
    expect(stdError([2, 4, 6])).toBeCloseTo(2 / Math.sqrt(3), 10);
  });
});

describe("ci95", () => {
  it("collapses to 0 with zero variance (identical scores)", () => {
    expect(ci95([80, 80, 80, 80, 80])).toBe(0);
  });
  it("shrinks as the sample grows (more data => more certainty)", () => {
    const small = ci95([70, 90]); // n = 2
    const large = ci95([70, 90, 70, 90, 70, 90, 70, 90]); // n = 8, same spread
    expect(large).toBeLessThan(small);
  });
});

describe("outcomeScore", () => {
  it("maps all-maximum inputs to exactly 100", () => {
    // This is the sanity anchor cited in the white paper (§9.1).
    expect(outcomeScore({ quizScore: 100, confidence: 5, recall: 100 })).toBe(100);
  });
  it("maps all-minimum inputs to 0", () => {
    expect(outcomeScore({ quizScore: 0, confidence: 1, recall: 0 })).toBe(0);
  });
  it("applies the documented 50/30/20 blend (quiz/recall/confidence)", () => {
    // confidence 3 -> (3-1)/4*100 = 50; 0.5*80 + 0.3*60 + 0.2*50 = 40 + 18 + 10 = 68
    expect(outcomeScore({ quizScore: 80, confidence: 3, recall: 60 })).toBe(68);
  });
  it("weights the quiz score most heavily", () => {
    const highQuiz = outcomeScore({ quizScore: 90, confidence: 3, recall: 50 });
    const highRecall = outcomeScore({ quizScore: 50, confidence: 3, recall: 90 });
    expect(highQuiz).toBeGreaterThan(highRecall);
  });
});

describe("trend", () => {
  it("is 0 until there are at least four points", () => {
    expect(trend([10, 20, 30])).toBe(0);
  });
  it("is positive when recent scores beat earlier ones", () => {
    expect(trend([50, 50, 80, 80])).toBeGreaterThan(0);
  });
  it("is negative when performance declines", () => {
    expect(trend([80, 80, 50, 50])).toBeLessThan(0);
  });
});

describe("round1", () => {
  it("rounds to one decimal place", () => {
    expect(round1(2.34)).toBeCloseTo(2.3, 10);
    expect(round1(2.36)).toBeCloseTo(2.4, 10);
    expect(round1(83.049)).toBe(83);
  });
});
