import { ci95, mean, outcomeScore, round1, trend } from "./stats";
import { techniqueLabel, type TechniqueId } from "./techniques";

/**
 * The recommendation engine.
 *
 * This is the heart of Calibrate and it is deliberately NOT an AI model. Given
 * the raw evidence (one record per outcome-checked session) it computes, per
 * subject, which technique is producing the best learning outcomes for THIS
 * student, how confident we should be, and how that compares to the starting
 * hypothesis from onboarding. Every number here is reproducible from the data.
 */

export interface EvidenceRecord {
  subjectId: string;
  subjectName: string;
  technique: TechniqueId | string;
  minutes: number;
  createdAt: string; // ISO, used only for ordering
  quizScore: number;
  confidence: number;
  recall: number;
}

export interface TechniqueStat {
  technique: string;
  label: string;
  n: number;
  avgScore: number;
  ci: number;
  trend: number;
  totalMinutes: number;
  scores: number[];
}

export type ConfidenceLevel = "insufficient" | "emerging" | "clear";

export interface SubjectInsight {
  subjectId: string;
  subjectName: string;
  totalSessions: number;
  techniques: TechniqueStat[];
  best?: TechniqueStat;
  runnerUp?: TechniqueStat;
  confidence: ConfidenceLevel;
  headline: string;
}

export interface InsightsReport {
  generatedAt: string;
  subjects: SubjectInsight[];
  overall: {
    totalSessions: number;
    totalMinutes: number;
    mostUsedTechnique?: string;
    bestOverallTechnique?: string;
  };
}

function statsForGroup(technique: string, records: EvidenceRecord[]): TechniqueStat {
  const ordered = [...records].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const scores = ordered.map(outcomeScore);
  return {
    technique,
    label: techniqueLabel(technique),
    n: scores.length,
    avgScore: round1(mean(scores)),
    ci: round1(ci95(scores)),
    trend: trend(scores),
    totalMinutes: ordered.reduce((a, r) => a + r.minutes, 0),
    scores: scores.map(round1),
  };
}

function classifyConfidence(best?: TechniqueStat, runnerUp?: TechniqueStat): ConfidenceLevel {
  if (!best || best.n < 3) return "insufficient";
  if (!runnerUp) return best.n >= 4 ? "emerging" : "insufficient";
  const separation = best.avgScore - runnerUp.avgScore;
  const overlap = best.ci + runnerUp.ci;
  if (best.n >= 4 && runnerUp.n >= 3 && separation > overlap) return "clear";
  return "emerging";
}

function headlineFor(
  subjectName: string,
  confidence: ConfidenceLevel,
  best?: TechniqueStat,
  runnerUp?: TechniqueStat,
): string {
  if (!best || confidence === "insufficient") {
    const need = best ? Math.max(0, 3 - best.n) : 3;
    return `Not enough data for ${subjectName} yet — log about ${need} more checked session${
      need === 1 ? "" : "s"
    } to get a read.`;
  }
  const lead = runnerUp ? round1(best.avgScore - runnerUp.avgScore) : 0;
  if (confidence === "clear") {
    return `${best.label} is clearly working best for ${subjectName} — averaging ${best.avgScore}/100${
      runnerUp ? `, ${lead} points ahead of ${runnerUp.label}` : ""
    }.`;
  }
  return `${best.label} is looking best for ${subjectName} (${best.avgScore}/100), but it is still close${
    runnerUp ? ` with ${runnerUp.label}` : ""
  } — keep testing to be sure.`;
}

export function computeInsights(records: EvidenceRecord[]): InsightsReport {
  const bySubject = new Map<string, EvidenceRecord[]>();
  for (const r of records) {
    const arr = bySubject.get(r.subjectId) ?? [];
    arr.push(r);
    bySubject.set(r.subjectId, arr);
  }

  const subjects: SubjectInsight[] = [];
  for (const [subjectId, subjectRecords] of bySubject) {
    const byTechnique = new Map<string, EvidenceRecord[]>();
    for (const r of subjectRecords) {
      const arr = byTechnique.get(r.technique) ?? [];
      arr.push(r);
      byTechnique.set(r.technique, arr);
    }
    const techniques = [...byTechnique.entries()]
      .map(([t, recs]) => statsForGroup(t, recs))
      .sort((a, b) => b.avgScore - a.avgScore);

    const best = techniques[0];
    const runnerUp = techniques[1];
    const confidence = classifyConfidence(best, runnerUp);

    subjects.push({
      subjectId,
      subjectName: subjectRecords[0].subjectName,
      totalSessions: subjectRecords.length,
      techniques,
      best,
      runnerUp,
      confidence,
      headline: headlineFor(subjectRecords[0].subjectName, confidence, best, runnerUp),
    });
  }

  subjects.sort((a, b) => b.totalSessions - a.totalSessions);

  // Overall roll-up across every subject.
  const techniqueTotals = new Map<string, { minutes: number; scores: number[] }>();
  for (const r of records) {
    const t = techniqueTotals.get(r.technique) ?? { minutes: 0, scores: [] };
    t.minutes += r.minutes;
    t.scores.push(outcomeScore(r));
    techniqueTotals.set(r.technique, t);
  }
  let mostUsedTechnique: string | undefined;
  let mostUsedMinutes = -1;
  let bestOverallTechnique: string | undefined;
  let bestOverallScore = -1;
  for (const [t, v] of techniqueTotals) {
    if (v.minutes > mostUsedMinutes) {
      mostUsedMinutes = v.minutes;
      mostUsedTechnique = techniqueLabel(t);
    }
    const avg = mean(v.scores);
    if (v.scores.length >= 3 && avg > bestOverallScore) {
      bestOverallScore = avg;
      bestOverallTechnique = techniqueLabel(t);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    subjects,
    overall: {
      totalSessions: records.length,
      totalMinutes: records.reduce((a, r) => a + r.minutes, 0),
      mostUsedTechnique,
      bestOverallTechnique,
    },
  };
}
