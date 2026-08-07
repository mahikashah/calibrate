/**
 * Deterministic structured questions for explicit local demos only.
 *
 * This produces the same shape returned by the FastAPI service so the
 * Question Bank, persistence, and review workflow exercise one path.
 */
export type StructuredQuestion = {
  type: "active_recall" | "mcq" | "feynman" | "fill_in_blank";
  question: string;
  answer: string;
  answer_choices: string[];
  source_excerpt: string;
};

function sentences(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function keyTerm(sentence: string) {
  return (
    sentence
      .replace(/[^\w\s-]/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 4)
      .sort((a, b) => b.length - a.length)[0] ?? "concept"
  );
}

export function generateDemoQuestions(text: string, requestedCount: number): StructuredQuestion[] {
  const sourceSentences = sentences(text);
  const fallback = text.trim().slice(0, 240) || "Review the key idea in this material.";
  const source = sourceSentences.length ? sourceSentences : [fallback];
  const patterns: Array<(excerpt: string) => StructuredQuestion> = [
    (excerpt) => ({
      type: "active_recall",
      question: `What do your notes say about ${keyTerm(excerpt)}?`,
      answer: excerpt,
      answer_choices: [],
      source_excerpt: excerpt,
    }),
    (excerpt) => {
      const answer = keyTerm(excerpt);
      return {
        type: "fill_in_blank",
        question: excerpt.replace(new RegExp(`\\b${answer}\\b`, "i"), "_____"),
        answer,
        answer_choices: [],
        source_excerpt: excerpt,
      };
    },
    (excerpt) => ({
      type: "feynman",
      question: `Explain this idea in your own words: ${excerpt.slice(0, 90)}${excerpt.length > 90 ? "…" : ""}`,
      answer: excerpt,
      answer_choices: [],
      source_excerpt: excerpt,
    }),
    (excerpt) => {
      const answer = keyTerm(excerpt);
      return {
        type: "mcq",
        question: `Which term does this passage support: “${excerpt.slice(0, 70)}${excerpt.length > 70 ? "…" : ""}”?`,
        answer,
        answer_choices: [answer, "An unrelated idea", "A different topic", "None of the notes"],
        source_excerpt: excerpt,
      };
    },
  ];

  // Rotate the excerpt independently of the pattern so a batch larger than the
  // pattern list still produces distinct questions instead of exact repeats.
  return Array.from({ length: requestedCount }, (_, index) => {
    const lap = Math.floor(index / patterns.length);
    const excerpt = source[(index + lap) % source.length];
    return patterns[index % patterns.length](excerpt);
  });
}