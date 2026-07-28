/**
 * The narrow surface where AI is allowed to touch StudyCoach.
 *
 * AI does exactly three jobs, all assistive and all optional:
 *   1. generateQuestions  — turn a student's own material into practice items
 *   2. feedback           — comment on a free-text answer to one question
 *   3. summarizeInsights  — phrase the *already-computed* dashboard numbers nicely
 *
 * It never decides which technique is best. That stays in recommend.ts.
 */

export type QuestionType = "recall" | "practice" | "feynman" | "cloze";

export interface GeneratedQuestion {
  type: QuestionType;
  prompt: string;
  answer: string;
}

export interface GenerateQuestionsInput {
  material: string;
  subject?: string;
  count: number;
}

export interface FeedbackInput {
  question: string;
  expected: string;
  answer: string;
}

export interface SummarizeInput {
  /** A compact, pre-computed view of the insights report. */
  subjects: {
    subjectName: string;
    confidence: string;
    bestTechnique?: string;
    bestScore?: number;
    headline: string;
  }[];
  totalSessions: number;
  totalMinutes: number;
}

export interface LlmProvider {
  readonly name: string;
  generateQuestions(input: GenerateQuestionsInput): Promise<GeneratedQuestion[]>;
  feedback(input: FeedbackInput): Promise<string>;
  summarizeInsights(input: SummarizeInput): Promise<string>;
}
