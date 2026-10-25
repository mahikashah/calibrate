import type {
  FeedbackInput,
  GenerateQuestionsInput,
  GeneratedQuestion,
  LlmProvider,
  SummarizeInput,
} from "./types";

/**
 * Any OpenAI-compatible /chat/completions endpoint. This includes the OpenAI
 * API and local open-source servers (LM Studio, llama.cpp `--api`, vLLM, or
 * Ollama's OpenAI-compat endpoint) — just point OPENAI_BASE_URL at them.
 */
export class OpenAiProvider implements LlmProvider {
  readonly name = "openai";
  private base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  private key = process.env.OPENAI_API_KEY || "";
  private model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  private async chat(system: string, user: string, json = false): Promise<string> {
    const res = await fetch(`${this.base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.key ? { Authorization: `Bearer ${this.key}` } : {}),
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) throw new Error(`OpenAI-compatible error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  }

  async generateQuestions(input: GenerateQuestionsInput): Promise<GeneratedQuestion[]> {
    const system =
      "You are a study-question generator. Return ONLY JSON " +
      '{"questions":[{"type":"recall|practice|feynman|cloze","prompt":"...","answer":"..."}]}. ' +
      "Questions must be answerable strictly from the provided material.";
    const user = `Subject: ${input.subject ?? "general"}\nCount: ${input.count}\nMaterial:\n"""${input.material}"""`;
    const raw = await this.chat(system, user, true);
    const parsed = JSON.parse(raw);
    return (parsed.questions ?? []).slice(0, input.count);
  }

  async feedback(input: FeedbackInput): Promise<string> {
    const system =
      "You are a supportive study coach. In 2-3 sentences, tell the student what they got right, what is missing, and one concrete next step.";
    const user = `Question: ${input.question}\nModel answer: ${input.expected}\nStudent answer: ${input.answer}`;
    return (await this.chat(system, user)).trim();
  }

  async summarizeInsights(input: SummarizeInput): Promise<string> {
    const system =
      "Summarize this study dashboard in 2-4 sentences. Only restate provided numbers; never invent techniques or claims.";
    return (await this.chat(system, JSON.stringify(input))).trim();
  }
}
