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
  /** Rotating encouragement shown in the sidebar. */
  cheers: string[];
}

const SHARED_CHEERS = ["You've got this!", "Proud of you for showing up 💚", "One step at a time."];

export const STUDY_BUDDIES: StudyBuddy[] = [
  {
    id: "minty",
    name: "Minty",
    technique: "active_recall",
    image: "/buddies/minty.png",
    tagline: "Closes the book and asks you to pull it from memory.",
    cheers: ["Close the book — what do you remember?", "Every recall makes it stick!", ...SHARED_CHEERS],
  },
  {
    id: "toffee",
    name: "Toffee",
    technique: "spaced_repetition",
    image: "/buddies/toffee.png",
    tagline: "Checks back in right when you're about to forget.",
    cheers: ["A little today, a little tomorrow!", "Spacing it out is working!", ...SHARED_CHEERS],
  },
  {
    id: "sage",
    name: "Sage",
    technique: "feynman",
    image: "/buddies/sage.png",
    tagline: "Loves it when you explain things in plain words.",
    cheers: ["Explain it like I'm five!", "If you can teach it, you know it!", ...SHARED_CHEERS],
  },
  {
    id: "mossy",
    name: "Mossy",
    technique: "practice_questions",
    image: "/buddies/mossy.png",
    tagline: "Your workout coach: problem after problem.",
    cheers: ["One more practice problem? 💪", "Mistakes are reps, keep going!", ...SHARED_CHEERS],
  },
  {
    id: "biscuit",
    name: "Biscuit",
    technique: "rereading",
    image: "/buddies/biscuit.png",
    tagline: "Calmly walks back through your notes with you.",
    cheers: ["Nice and steady wins it!", "Let's look back over it together.", ...SHARED_CHEERS],
  },
];
