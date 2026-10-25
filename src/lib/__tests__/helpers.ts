import type { EvidenceRecord } from "../recommend";

/**
 * A tiny seeded PRNG so any "jittered" test data is fully deterministic across
 * runs — otherwise a test that depends on variance would be flaky. This is the
 * same generator idea used by the seed script.
 */
export function makeRng(seed = 12345): () => number {
  let s = seed % 0x7fffffff;
  if (s <= 0) s += 0x7ffffffe;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export interface RecordSpec {
  subject: string;
  technique: string;
  /** Base value for quizScore/recall (0..100). Outcome score is derived from this. */
  base: number;
  n: number;
  /** +/- spread applied to quizScore and recall to simulate realistic variance. */
  jitter?: number;
  confidence?: number;
  minutes?: number;
  rng?: () => number;
}

/**
 * Build `n` evidence records for one (subject, technique). With `jitter = 0`
 * every record is identical (zero variance); with a positive jitter each score
 * wobbles deterministically around `base`.
 *
 * Timestamps run oldest -> newest so ordering-dependent logic (e.g. trend) sees
 * a sensible sequence.
 */
export function makeRecords(spec: RecordSpec): EvidenceRecord[] {
  const { subject, technique, base, n } = spec;
  const jitter = spec.jitter ?? 0;
  const confidence = spec.confidence ?? 4;
  const minutes = spec.minutes ?? 25;
  const rng = spec.rng ?? makeRng();

  const clamp = (x: number) => Math.max(0, Math.min(100, Math.round(x)));
  return Array.from({ length: n }, (_, i) => {
    const wobble = jitter === 0 ? 0 : (rng() - 0.5) * jitter * 2;
    const score = clamp(base + wobble);
    return {
      subjectId: subject,
      subjectName: subject,
      technique,
      minutes,
      // Oldest first: index 0 is the earliest session.
      createdAt: new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString(),
      quizScore: score,
      confidence,
      recall: score,
    } satisfies EvidenceRecord;
  });
}
