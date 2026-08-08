/**
 * POST /api/questions/generate
 *
 * Server-side route that:
 *   1. Validates subject and material ownership.
 *   2. Calls the FastAPI ML service to generate structured questions.
 *   3. Validates the response with Zod before writing to the database.
 *   4. Returns the persisted question rows.
 *
 * The browser never communicates with FastAPI directly.
 * ML_SERVICE_API_KEY is read only from process.env and is never sent to
 * the client.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { materials, questions, subjects } from "@/lib/db/schema";
import { handle, ok, fail } from "@/lib/http";
import { newId } from "@/lib/ids";
import { generateDemoQuestions } from "@/lib/demo-questions";
import { generateQuestions as mlGenerate, MlServiceError } from "@/lib/ml-service";
import {
  QUESTION_COUNT_DEFAULT,
  QUESTION_COUNT_MAX,
  QUESTION_COUNT_MIN,
} from "@/lib/question-count";
import { currentUserId } from "@/lib/user";

const GenerateReq = z.object({
  subjectId: z.string().min(1),
  // subjectName is accepted for backwards-compat with the Question Bank UI
  // but ignored — the subject name is always read from the verified DB row.
  subjectName: z.string().optional(),
  materialId: z.string().optional(),
  materialText: z.string().optional(),
  // Target count: generate up to N grounded questions (not a hard quota).
  count: z
    .number()
    .int()
    .min(QUESTION_COUNT_MIN)
    .max(QUESTION_COUNT_MAX)
    .default(QUESTION_COUNT_DEFAULT),
  save: z.boolean().default(true),
});

function mlErrorStatus(code: string): number {
  if (code === "NOTES_TOO_LONG") return 422;
  if (code === "MODEL_TIMEOUT") return 504;
  if (code === "ML_SERVICE_UNAVAILABLE") return 503;
  return 502;
}

export async function POST(req: Request) {
  return handle(async () => {
    const body = GenerateReq.parse(await req.json());
    const userId = currentUserId();

    // --- Ownership checks (Next.js concern — never delegated to FastAPI) ---
    const subject = db.select().from(subjects).where(eq(subjects.id, body.subjectId)).get();
    if (!subject || subject.userId !== userId) return fail("Subject not found.", 404);

    let materialText = body.materialText ?? "";
    const materialId = body.materialId ?? null;

    if (materialId) {
      const m = db.select().from(materials).where(eq(materials.id, materialId)).get();
      if (!m || m.userId !== userId) return fail("Material not found.", 404);
      if (m.subjectId !== body.subjectId) return fail("Material does not belong to this subject.", 422);
      if (!materialText) materialText = m.content;
    }
    if (!materialText.trim()) return fail("Provide materialText or a materialId with content.", 422);

    // Demo mode is intentionally explicit. Real service failures never fall
    // back to demo questions.
    let generated;
    const demoMode = process.env.CALIBRATE_DEMO_MODE === "true";
    if (demoMode) {
      generated = generateDemoQuestions(materialText, body.count);
    } else {
      try {
        generated = await mlGenerate({
          subject: subject.name,
          text: materialText,
          requestedCount: body.count,
        });
      } catch (err) {
        if (err instanceof MlServiceError) {
          return fail(err.studentMessage, mlErrorStatus(err.code));
        }
        throw err;
      }
    }

    // --- Map FastAPI response → database rows ---
    const rows = generated.map((q) => ({
      id: newId("q"),
      userId,
      subjectId: body.subjectId,
      materialId,
      type: q.type,
      prompt: q.question,
      answer: q.answer,
      answerChoices: JSON.stringify(q.answer_choices),
      sourceExcerpt: q.source_excerpt,
      status: "generated" as const,
      source: "ai",
      createdAt: new Date().toISOString(),
    }));

    if (!rows.length) {
      return fail(
        "We couldn’t generate grounded questions from this material. Try adding more detailed notes or a different text-based PDF.",
        422,
      );
    }

    if (body.save) db.insert(questions).values(rows).run();

    // There is no fallback provider: a failed real generation surfaces as an
    // error above, so the provider always reflects the mode that actually ran.
    return ok(
      {
        provider: demoMode ? "calibrate-demo" : "calibrate-ml",
        questions: rows,
        questionCount: rows.length,
        requestedCount: body.count,
      },
      201,
    );
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
