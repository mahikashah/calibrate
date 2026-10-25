export type StudyQuestionType = "active_recall" | "mcq" | "feynman" | "fill_in_blank";

export function normalizeAnswer(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function isSimpleAnswerCorrect(answer: string, expected: string) {
  return normalizeAnswer(answer) === normalizeAnswer(expected);
}

export function parseAnswerChoices(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) && parsed.every((choice) => typeof choice === "string") ? parsed : [];
  } catch {
    return [];
  }
}

export function isValidMcq(answer: string, choices: string[]) {
  const normalized = choices.map(normalizeAnswer);
  return choices.length === 4 &&
    choices.every((choice) => Boolean(choice.trim())) &&
    new Set(normalized).size === 4 &&
    normalized.includes(normalizeAnswer(answer));
}

export function questionTypeLabel(type: string) {
  const labels: Record<string, string> = {
    active_recall: "Active Recall",
    mcq: "Multiple Choice",
    feynman: "Feynman / Self-Explanation",
    fill_in_blank: "Fill in the Blank",
  };
  return labels[type] ?? "Practice question";
}