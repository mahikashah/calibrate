/**
 * The catalog of study techniques the app knows how to run and compare.
 *
 * The `evidence` field is a plain-language pointer to the cognitive-science
 * literature. StudyCoach never tells a student "you are a visual learner" — the
 * learning-styles idea has no experimental support. Instead it runs the
 * techniques below *as experiments* and lets each student's own data decide.
 */

export type TechniqueId =
  | "active_recall"
  | "spaced_repetition"
  | "feynman"
  | "practice_questions"
  | "rereading";

export interface Technique {
  id: TechniqueId;
  label: string;
  /** "active" techniques are effortful retrieval; "passive" ones are the controls. */
  kind: "active" | "passive";
  blurb: string;
  howTo: string[];
  evidence: string;
}

export const TECHNIQUES: Technique[] = [
  {
    id: "active_recall",
    label: "Active recall",
    kind: "active",
    blurb: "Close the book and pull the answer from memory before checking.",
    howTo: [
      "Read a chunk of material, then hide it.",
      "Write or say everything you can remember, unaided.",
      "Reveal the source and mark what you missed.",
    ],
    evidence:
      "The testing effect: retrieving information strengthens memory far more than re-reading (Roediger & Karpicke, 2006).",
  },
  {
    id: "spaced_repetition",
    label: "Spaced repetition",
    kind: "active",
    blurb: "Revisit material at growing intervals so it sticks for the long run.",
    howTo: [
      "Study the set today.",
      "Review again after a short gap, then a longer one.",
      "Let items you know well drift to longer intervals.",
    ],
    evidence:
      "The spacing effect: distributing practice over time beats massing it (Cepeda et al., 2006).",
  },
  {
    id: "feynman",
    label: "Feynman / self-explanation",
    kind: "active",
    blurb: "Explain the idea in plain words as if teaching a beginner.",
    howTo: [
      "Pick one concept and write an explanation for a 12-year-old.",
      "Notice every place you get stuck or hand-wave.",
      "Go back to the source, fix the gap, simplify again.",
    ],
    evidence:
      "Self-explanation and the generation of one's own reasoning improves comprehension and transfer (Chi et al., 1994).",
  },
  {
    id: "practice_questions",
    label: "Practice questions",
    kind: "active",
    blurb: "Work real problems under near-exam conditions.",
    howTo: [
      "Attempt questions without notes.",
      "Grade honestly and log which types you miss.",
      "Re-attempt the misses after a short delay.",
    ],
    evidence:
      "Practice testing is among the highest-utility techniques reviewed by Dunlosky et al. (2013).",
  },
  {
    id: "rereading",
    label: "Re-reading (control)",
    kind: "passive",
    blurb: "Re-read notes and highlight. Included as an honest baseline to beat.",
    howTo: [
      "Re-read the material once through.",
      "Highlight what feels important.",
      "Take the outcome check like any other session.",
    ],
    evidence:
      "Re-reading and highlighting feel productive but rate low for durable learning (Dunlosky et al., 2013). It is the control condition.",
  },
];

export const TECHNIQUE_BY_ID: Record<TechniqueId, Technique> = Object.fromEntries(
  TECHNIQUES.map((t) => [t.id, t]),
) as Record<TechniqueId, Technique>;

export function techniqueLabel(id: string): string {
  return TECHNIQUE_BY_ID[id as TechniqueId]?.label ?? id;
}
