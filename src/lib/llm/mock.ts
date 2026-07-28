import type {
  FeedbackInput,
  GenerateQuestionsInput,
  GeneratedQuestion,
  LlmProvider,
  SummarizeInput,
} from "./types";

/**
 * A fully offline, deterministic "LLM" built from plain heuristics.
 *
 * It is good enough to make the whole app work with zero setup and zero API
 * keys — the demo generates real, sensible questions from pasted material. Swap
 * in the ollama or openai provider (see .env) for genuinely generated content.
 */

const STOP = new Set(
  "the a an and or of to in on for with is are was were be been being that this these those it its as at by from into than then so such can may will would could should our your their his her they we you i".split(
    " ",
  ),
);

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 30 && /[a-zA-Z]/.test(s));
}

function keyword(sentence: string): string | null {
  const words = sentence
    .replace(/[^\w\s-]/g, "")
    .split(" ")
    .filter((w) => w.length > 5 && !STOP.has(w.toLowerCase()));
  if (words.length === 0) return null;
  // Prefer a capitalized term (likely a proper noun / key concept), else longest.
  const cap = words.find((w) => /^[A-Z]/.test(w));
  return cap ?? words.sort((a, b) => b.length - a.length)[0];
}

function topic(sentence: string): string {
  const words = sentence.split(" ").filter((w) => w.length > 4 && !STOP.has(w.toLowerCase()));
  return words.slice(0, 3).join(" ") || sentence.slice(0, 40);
}

export class MockProvider implements LlmProvider {
  readonly name = "mock";

  async generateQuestions(input: GenerateQuestionsInput): Promise<GeneratedQuestion[]> {
    const sentences = splitSentences(input.material);
    const out: GeneratedQuestion[] = [];
    const patterns: Array<(s: string) => GeneratedQuestion | null> = [
      // cloze deletion
      (s) => {
        const k = keyword(s);
        if (!k) return null;
        return {
          type: "cloze",
          prompt: s.replace(new RegExp(`\\b${k}\\b`), "_____"),
          answer: k,
        };
      },
      // active recall
      (s) => ({
        type: "recall",
        prompt: `Without looking, explain: ${topic(s)}.`,
        answer: s,
      }),
      // self-explanation / Feynman
      (s) => ({
        type: "feynman",
        prompt: `Teach it back in plain words: why does "${topic(s)}" matter here?`,
        answer: s,
      }),
    ];

    let i = 0;
    while (out.length < input.count && sentences.length > 0) {
      const sentence = sentences[i % sentences.length];
      const make = patterns[out.length % patterns.length];
      const q = make(sentence);
      if (q && !out.some((e) => e.prompt === q.prompt)) out.push(q);
      i++;
      if (i > sentences.length * patterns.length) break; // avoid infinite loop
    }

    if (out.length === 0) {
      out.push({
        type: "recall",
        prompt: "Summarize the main idea of your material from memory.",
        answer: input.material.slice(0, 240),
      });
    }
    return out.slice(0, input.count);
  }

  async feedback(input: FeedbackInput): Promise<string> {
    const norm = (s: string) =>
      new Set(
        s
          .toLowerCase()
          .replace(/[^\w\s]/g, "")
          .split(/\s+/)
          .filter((w) => w.length > 3 && !STOP.has(w)),
      );
    const expected = norm(input.expected);
    const got = norm(input.answer);
    let hit = 0;
    for (const w of expected) if (got.has(w)) hit++;
    const coverage = expected.size ? Math.round((hit / expected.size) * 100) : 0;
    const missing = [...expected].filter((w) => !got.has(w)).slice(0, 4);

    if (coverage >= 70) {
      return `Strong recall — you covered about ${coverage}% of the key ideas. Now try explaining it once more without any prompts to lock it in.`;
    }
    if (coverage >= 35) {
      return `Decent start (~${coverage}% of key ideas). You seem to be missing: ${missing.join(
        ", ",
      )}. Re-check those, then retry from memory.`;
    }
    return `This one needs another pass (~${coverage}% overlap). Focus your next review on: ${
      missing.join(", ") || "the core definitions"
    }, then attempt active recall again.`;
  }

  async summarizeInsights(input: SummarizeInput): Promise<string> {
    if (input.subjects.length === 0) {
      return "No checked sessions yet. Once you log a few study sessions with outcome checks, this space will summarize which techniques are working best for you.";
    }
    const clear = input.subjects.filter((s) => s.confidence === "clear");
    const lead = clear[0] ?? input.subjects[0];
    const hours = Math.round((input.totalMinutes / 60) * 10) / 10;
    const parts: string[] = [];
    parts.push(
      `You have logged ${input.totalSessions} checked sessions (~${hours}h).`,
    );
    if (lead.bestTechnique) {
      parts.push(
        `For ${lead.subjectName}, ${lead.bestTechnique} is currently your strongest technique (${lead.bestScore}/100).`,
      );
    }
    const stillClose = input.subjects.filter((s) => s.confidence === "emerging");
    if (stillClose.length) {
      parts.push(
        `${stillClose
          .map((s) => s.subjectName)
          .slice(0, 2)
          .join(" and ")} ${stillClose.length === 1 ? "is" : "are"} still close — a few more sessions will settle it.`,
      );
    }
    return parts.join(" ");
  }
}
