import type { TechniqueId } from "./techniques";
import { techniqueLabel } from "./techniques";

/**
 * Onboarding forms a STARTING HYPOTHESIS — an educated first guess about which
 * techniques might suit this student — from a few behavioral questions about how
 * they actually study and where they struggle. It is explicitly a guess to be
 * tested by real data, never a fixed "learning style" label.
 *
 * The mapping is a transparent, rule-based scoring table. Anyone can read it.
 */

export interface OnboardingOption {
  label: string;
  weights: Partial<Record<TechniqueId, number>>;
}
export interface OnboardingQuestion {
  id: string;
  text: string;
  options: OnboardingOption[];
}

export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    id: "retention",
    text: "You re-read your notes and feel like you know it. A few days later, how much sticks?",
    options: [
      { label: "Most of it fades fast", weights: { spaced_repetition: 3, active_recall: 1 } },
      { label: "Some fades", weights: { spaced_repetition: 2, active_recall: 1 } },
      { label: "It mostly holds up", weights: { practice_questions: 1 } },
    ],
  },
  {
    id: "struggle",
    text: "What trips you up most?",
    options: [
      { label: "Forgetting over time", weights: { spaced_repetition: 3 } },
      { label: "Blanking under test pressure", weights: { practice_questions: 3, active_recall: 2 } },
      { label: "Not really understanding the idea", weights: { feynman: 3 } },
      { label: "Understanding but not applying it", weights: { practice_questions: 2, feynman: 1 } },
    ],
  },
  {
    id: "check",
    text: "How do you usually check whether you truly know something?",
    options: [
      { label: "I re-read until it feels familiar", weights: { active_recall: 3, rereading: 1 } },
      { label: "I try to recall it from memory", weights: { active_recall: 1 } },
      { label: "I explain it to someone", weights: { feynman: 2 } },
      { label: "I do problems", weights: { practice_questions: 2 } },
    ],
  },
  {
    id: "consistency",
    text: "How consistent is your study schedule?",
    options: [
      { label: "I cram close to deadlines", weights: { spaced_repetition: 3 } },
      { label: "Somewhat regular", weights: { spaced_repetition: 1 } },
      { label: "Very regular", weights: {} },
    ],
  },
  {
    id: "subject_type",
    text: "Which is closest to what you're studying right now?",
    options: [
      { label: "Problem-solving (math, coding, physics)", weights: { practice_questions: 2, feynman: 1 } },
      { label: "Concept-heavy (biology, law, theory)", weights: { active_recall: 2, feynman: 1 } },
      { label: "Memorization-heavy (vocab, facts, terms)", weights: { spaced_repetition: 2, active_recall: 1 } },
    ],
  },
];

export interface Hypothesis {
  ranked: { technique: TechniqueId; label: string; score: number }[];
  primary: TechniqueId;
  rationale: string;
}

/** answers: map of questionId -> chosen option index. */
export function computeHypothesis(answers: Record<string, number>): Hypothesis {
  const scores: Record<string, number> = {};
  for (const q of ONBOARDING_QUESTIONS) {
    const idx = answers[q.id];
    const opt = q.options[idx];
    if (!opt) continue;
    for (const [tech, w] of Object.entries(opt.weights)) {
      scores[tech] = (scores[tech] ?? 0) + (w ?? 0);
    }
  }
  const ranked = (Object.entries(scores) as [TechniqueId, number][])
    .map(([technique, score]) => ({ technique, label: techniqueLabel(technique), score }))
    .sort((a, b) => b.score - a.score);

  // Always give the student at least a couple of active techniques to try.
  if (ranked.length === 0) {
    ranked.push(
      { technique: "active_recall", label: techniqueLabel("active_recall"), score: 0 },
      { technique: "practice_questions", label: techniqueLabel("practice_questions"), score: 0 },
    );
  }
  const primary = ranked[0].technique;
  const rationale =
    `Based on your answers, a good first technique to test is ${ranked[0].label.toLowerCase()}` +
    (ranked[1] ? `, followed by ${ranked[1].label.toLowerCase()}` : "") +
    `. This is only a starting guess — StudyCoach will confirm or overturn it with your real session data.`;

  return { ranked, primary, rationale };
}
