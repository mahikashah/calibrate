import type {
  FeedbackInput,
  GenerateQuestionsInput,
  GeneratedQuestion,
  LlmProvider,
  SummarizeInput,
} from "./types";

/**
 * Talks to a local Ollama server (https://ollama.com) — fully open source and
 * offline once a model is pulled, e.g. `ollama pull llama3.1`.
 */
export class OllamaProvider implements LlmProvider {
  readonly name = "ollama";
  private base = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  private model = process.env.OLLAMA_MODEL || "llama3.1";

  private async chat(system: string, user: string, json = false): Promise<string> {
    const res = await fetch(`${this.base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        ...(json ? { format: "json" } : {}),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data?.message?.content ?? "";
  }

  async generateQuestions(input: GenerateQuestionsInput): Promise<GeneratedQuestion[]> {
    const system =
      "You are a study-question generator. Return ONLY JSON of the form " +
      '{"questions":[{"type":"recall|practice|feynman|cloze","prompt":"...","answer":"..."}]}. ' +
      "Questions must be answerable strictly from the provided material.";
    const user = `Subject: ${input.subject ?? "general"}\nCount: ${input.count}\nMaterial:\n"""${input.material}"""`;
    const raw = await this.chat(system, user, true);
    const parsed = JSON.parse(raw);
    return (parsed.questions ?? []).slice(0, input.count);
  }

  async feedback(input: FeedbackInput): Promise<string> {
    const system =
      "You are a supportive study coach. In 2-3 sentences, tell the student what they got right, what is missing, and one concrete next step. Be specific and kind.";
    const user = `Question: ${input.question}\nModel answer: ${input.expected}\nStudent answer: ${input.answer}`;
    return (await this.chat(system, user)).trim();
  }

  async summarizeInsights(input: SummarizeInput): Promise<string> {
    const system =
      "You summarize a study dashboard in 2-4 sentences. Only restate the numbers you are given; never invent techniques or claims.";
    const user = JSON.stringify(input);
    return (await this.chat(system, user)).trim();
  }
}
