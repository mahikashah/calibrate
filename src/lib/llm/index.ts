import { MockProvider } from "./mock";
import { OllamaProvider } from "./ollama";
import { OpenAiProvider } from "./openai";
import type { LlmProvider } from "./types";

export * from "./types";

const mock = new MockProvider();

/** Returns the configured provider, defaulting to the offline mock. */
export function getProvider(): LlmProvider {
  switch ((process.env.LLM_PROVIDER || "mock").toLowerCase()) {
    case "ollama":
      return new OllamaProvider();
    case "openai":
      return new OpenAiProvider();
    default:
      return mock;
  }
}

/**
 * Run an LLM call but never let a flaky/unconfigured model break the UX: if the
 * real provider throws, transparently fall back to the deterministic mock and
 * report which one actually answered so the UI can label AI output honestly.
 */
export async function withFallback<T>(
  fn: (p: LlmProvider) => Promise<T>,
): Promise<{ result: T; provider: string; fellBack: boolean }> {
  const provider = getProvider();
  if (provider.name === "mock") {
    return { result: await fn(provider), provider: "mock", fellBack: false };
  }
  try {
    return { result: await fn(provider), provider: provider.name, fellBack: false };
  } catch (err) {
    console.warn(`[llm] ${provider.name} failed, falling back to mock:`, (err as Error).message);
    return { result: await fn(mock), provider: "mock", fellBack: true };
  }
}
