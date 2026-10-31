import type { TechniqueId } from "./techniques";

/**
 * Study buddies are the mascot characters a student picks at the end of
 * onboarding. Each one stands for a study technique, so the buddy is a friendly
 * face for that technique — it does not change the starting hypothesis, which
 * comes only from the behavioral questions.
 */
export interface StudyBuddy {
  id: string;
  name: string;
  technique: TechniqueId;
  image: string;
  tagline: string;
}

export const STUDY_BUDDIES: StudyBuddy[] = [
  {
    id: "minty",
    name: "Minty",
    technique: "active_recall",
    image: "/buddies/minty.png",
    tagline: "Closes the book and asks you to pull it from memory.",
  },
  {
    id: "toffee",
    name: "Toffee",
    technique: "spaced_repetition",
    image: "/buddies/toffee.png",
    tagline: "Checks back in right when you're about to forget.",
  },
  {
    id: "sage",
    name: "Sage",
    technique: "feynman",
    image: "/buddies/sage.png",
    tagline: "Loves it when you explain things in plain words.",
  },
  {
    id: "mossy",
    name: "Mossy",
    technique: "practice_questions",
    image: "/buddies/mossy.png",
    tagline: "Your workout coach: problem after problem.",
  },
  {
    id: "biscuit",
    name: "Biscuit",
    technique: "rereading",
    image: "/buddies/biscuit.png",
    tagline: "Calmly walks back through your notes with you.",
  },
];
