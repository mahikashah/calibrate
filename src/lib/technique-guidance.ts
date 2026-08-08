/**
 * User-facing Study guidance for each catalog technique.
 * Descriptions must match what the Study session actually does.
 */
import { TECHNIQUE_BY_ID, type TechniqueId } from "./techniques";

export type TechniqueGuidance = {
  id: TechniqueId;
  label: string;
  shortDescription: string;
  howTo: string[];
  measures: string;
  sessionWorks: string;
};

const GUIDANCE: Record<TechniqueId, Omit<TechniqueGuidance, "id" | "label">> = {
  active_recall: {
    shortDescription: "Retrieve information from memory before checking the answer or notes.",
    howTo: [
      "Read the prompt.",
      "Answer from memory without looking at notes.",
      "Reveal the reference answer.",
      "Mark Correct or Needs Work, then continue.",
    ],
    measures: "Your question performance (accuracy, recall, and confidence) plus session length as context.",
    sessionWorks: "Answer each approved question from memory before revealing the answer.",
  },
  practice_questions: {
    shortDescription: "Answer questions without assistance, then check your results.",
    howTo: [
      "Answer the approved question without notes.",
      "Submit and reveal the reference answer.",
      "Check Correct or Needs Work honestly.",
      "Continue through the set.",
    ],
    measures: "Question performance and the same outcome metrics used for other techniques.",
    sessionWorks: "Work through approved questions under near-exam conditions, then check each answer.",
  },
  feynman: {
    shortDescription: "Explain the concept in your own words as if teaching someone else.",
    howTo: [
      "Read the concept or question prompt.",
      "Explain it from memory in plain language.",
      "Reveal the reference answer and supporting notes.",
      "Self-check Correct or Needs Work — Calibrate does not auto-grade essays.",
    ],
    measures: "Your self-checked performance plus confidence and recall on the outcome check.",
    sessionWorks: "Explain each prompt in your own words, then compare with the reference answer.",
  },
  spaced_repetition: {
    shortDescription:
      "Revisit previously studied information and test whether you still remember it.",
    howTo: [
      "Answer the approved questions from memory.",
      "Reveal and check each reference answer.",
      "Treat this as a spaced check against material you have already reviewed.",
      "Calibrate does not schedule future reviews automatically in this version.",
    ],
    measures: "Outcome-check performance on approved questions — not a built-in review calendar.",
    sessionWorks:
      "Test yourself on approved questions now. Scheduling of future intervals is not automated yet.",
  },
  rereading: {
    shortDescription: "Review the material normally, then complete an outcome check afterward.",
    howTo: [
      "Re-read the material once through when it is available.",
      "Then answer the approved outcome-check questions from memory.",
      "Reveal and evaluate each answer.",
      "Calibrate compares the outcome check — not how long you spent reading.",
    ],
    measures: "The post-reading outcome check on approved questions. Time spent reading is context only.",
    sessionWorks:
      "Review the material first if available, then complete an outcome check with approved questions.",
  },
};

export function techniqueGuidance(id: TechniqueId | string): TechniqueGuidance {
  const technique = TECHNIQUE_BY_ID[id as TechniqueId];
  const guide = GUIDANCE[id as TechniqueId];
  if (!technique || !guide) {
    return {
      id: "active_recall",
      label: String(id),
      shortDescription: "Test this technique with approved questions.",
      howTo: ["Answer from memory.", "Reveal the reference answer.", "Mark Correct or Needs Work."],
      measures: "Your outcome-check performance.",
      sessionWorks: "Complete the approved-question outcome check for this technique.",
    };
  }
  return { id: technique.id, label: technique.label, ...guide };
}
