/**
 * Server-only FastAPI ML service client.
 *
 * This module must NEVER be imported by client-side code. ML_SERVICE_API_KEY
 * is read only from process.env and is never serialised into browser bundles.
 *
 * All errors are translated into MlServiceError so callers can map them to
 * student-facing messages without exposing provider internals.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export type MlErrorCode =
  | "NOTES_TOO_LONG"
  | "UNSUPPORTED_PDF"
  | "PDF_PARSE_FAILED"
  | "MODEL_TIMEOUT"
  | "INVALID_MODEL_RESPONSE"
  | "GENERATION_FAILED"
  | "ML_SERVICE_UNAVAILABLE";

export class MlServiceError extends Error {
  constructor(
    public readonly code: MlErrorCode,
    message: string,
    public readonly studentMessage: string,
  ) {
    super(message);
    this.name = "MlServiceError";
  }
}

// Student-facing copy for every error the service can return.
const STUDENT_MESSAGES: Record<MlErrorCode, string> = {
  NOTES_TOO_LONG:
    "This material is too long. Try one lecture, chapter, or study section at a time.",
  UNSUPPORTED_PDF:
    "This PDF appears to be scanned. Try a text-based PDF or paste your notes instead.",
  PDF_PARSE_FAILED: "We couldn't read this PDF. Please try a different file.",
  MODEL_TIMEOUT: "Question generation took too long. Please try again.",
  INVALID_MODEL_RESPONSE:
    "We couldn't generate valid questions from this material. Please try again.",
  GENERATION_FAILED: "Question generation failed. Please try again.",
  ML_SERVICE_UNAVAILABLE:
    "Question generation is temporarily unavailable. Please try again.",
};

// ---------------------------------------------------------------------------
// Response schemas — validate ML output before trusting it
// ---------------------------------------------------------------------------

const MlQuestionSchema = z.object({
  type: z.enum(["active_recall", "mcq", "feynman", "fill_in_blank"]),
  question: z.string().min(1),
  answer: z.string().min(1),
  answer_choices: z.array(z.string()),
  source_excerpt: z.string(),
});

const GenerateResponseSchema = z.object({
  questions: z.array(MlQuestionSchema),
});

const ParsePdfResponseSchema = z.object({
  text: z.string(),
  word_count: z.number().int(),
  approx_token_count: z.number().int(),
  file_name: z.string(),
});

export type MlQuestion = z.infer<typeof MlQuestionSchema>;
export type ParsePdfResult = z.infer<typeof ParsePdfResponseSchema>;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// 120 s — 90 s HF model timeout + 30 s overhead for network/queue.
const TIMEOUT_MS = 120_000;

function mlUrl(path: string): string {
  const base = (process.env.ML_SERVICE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  return `${base}${path}`;
}

function authHeaders(): Record<string, string> {
  const key = process.env.ML_SERVICE_API_KEY;
  return key ? { "X-ML-Service-Key": key } : {};
}

async function fetchMl(url: string, init: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    const isAbort = err instanceof Error && err.name === "AbortError";
    const code: MlErrorCode = isAbort ? "MODEL_TIMEOUT" : "ML_SERVICE_UNAVAILABLE";
    throw new MlServiceError(code, String(err), STUDENT_MESSAGES[code]);
  }
  clearTimeout(timer);

  // Parse JSON regardless of status so we can read the structured error code.
  const body: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorCode = (body as { code?: string }).code as MlErrorCode | undefined;
    const code: MlErrorCode =
      errorCode && errorCode in STUDENT_MESSAGES ? errorCode : "GENERATION_FAILED";
    throw new MlServiceError(
      code,
      `ML service returned HTTP ${res.status}`,
      STUDENT_MESSAGES[code],
    );
  }

  return body;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Call FastAPI POST /generate-questions.
 * Returns the validated question array.
 * Throws MlServiceError on any failure.
 */
export async function generateQuestions(opts: {
  subject: string;
  text: string;
  requestedCount: number;
}): Promise<MlQuestion[]> {
  const raw = await fetchMl(mlUrl("/generate-questions"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      subject: opts.subject,
      text: opts.text,
      requested_count: opts.requestedCount,
    }),
  });

  const parsed = GenerateResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new MlServiceError(
      "INVALID_MODEL_RESPONSE",
      `ML response failed schema validation: ${parsed.error.message}`,
      STUDENT_MESSAGES.INVALID_MODEL_RESPONSE,
    );
  }

  return parsed.data.questions;
}

/**
 * Call FastAPI POST /parse-pdf.
 * Returns the normalised text and metadata.
 * Throws MlServiceError on any failure.
 */
export async function parsePdf(file: Blob, fileName: string): Promise<ParsePdfResult> {
  const form = new FormData();
  form.append("file", file, fileName);

  const raw = await fetchMl(mlUrl("/parse-pdf"), {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });

  const parsed = ParsePdfResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new MlServiceError(
      "PDF_PARSE_FAILED",
      `PDF parse response failed schema validation: ${parsed.error.message}`,
      STUDENT_MESSAGES.PDF_PARSE_FAILED,
    );
  }

  return parsed.data;
}
