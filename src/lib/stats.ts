/**
 * Tiny, dependency-free statistics used by the recommendation engine.
 *
 * Everything here is deliberately simple and inspectable. The whole point of
 * StudyCoach is that a student (or a curious 4th-year CS reader) can open this
 * file and see exactly how a recommendation is computed — no black box.
 */

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

/** Standard error of the mean. */
export function stdError(xs: number[]): number {
  if (xs.length < 2) return 0;
  return stdDev(xs) / Math.sqrt(xs.length);
}

/**
 * 95% confidence interval half-width for the mean, using a z≈1.96 approximation.
 * With small samples this is wide on purpose — it keeps the app honest about how
 * little it knows early on.
 */
export function ci95(xs: number[]): number {
  return 1.96 * stdError(xs);
}

/**
 * A normalized 0..100 "outcome score" for a single session, blending the three
 * signals a student logs. Weights are explicit and shown to the user.
 */
export function outcomeScore(o: {
  quizScore: number; // 0..100
  confidence: number; // 1..5
  recall: number; // 0..100
}): number {
  const confidencePct = ((o.confidence - 1) / 4) * 100; // 1..5 -> 0..100
  const blended = 0.5 * o.quizScore + 0.2 * confidencePct + 0.3 * o.recall;
  return Math.round(blended * 10) / 10;
}

/**
 * Simple trend: mean of the most recent half minus mean of the earlier half.
 * Positive means the technique is improving for this student over time.
 */
export function trend(scoresOldToNew: number[]): number {
  if (scoresOldToNew.length < 4) return 0;
  const mid = Math.floor(scoresOldToNew.length / 2);
  const earlier = scoresOldToNew.slice(0, mid);
  const recent = scoresOldToNew.slice(mid);
  return Math.round((mean(recent) - mean(earlier)) * 10) / 10;
}

export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
