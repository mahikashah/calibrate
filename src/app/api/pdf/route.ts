/**
 * POST /api/pdf
 *
 * Accepts a PDF file upload from the browser, parses it via FastAPI, saves the
 * extracted text as a Material record, generates questions, saves them, and
 * returns the counts. The browser never talks to FastAPI directly.
 *
 * Parsing always goes through FastAPI (no model call). Question generation
 * follows the same explicit CALIBRATE_DEMO_MODE switch as
 * /api/questions/generate, and never falls back from one mode to the other.
 *
 * Form fields:
 *   file      — PDF binary, at most PDF_MAX_BYTES (required)
 *   subjectId — string (required)
 *   title     — string (optional, defaults to file name)
 *   count     — integer 1-10 (optional, defaults to 6)
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { materials, questions, subjects } from "@/lib/db/schema";
import { generateDemoQuestions } from "@/lib/demo-questions";
import { capMessage, checkGenerationCap, recordGeneration } from "@/lib/generation-cap";
import { handle, ok, fail } from "@/lib/http";
import { newId } from "@/lib/ids";
import { generateQuestions, parsePdf, MlServiceError } from "@/lib/ml-service";
import { pdfUploadError, PDF_TOO_LARGE_MESSAGE } from "@/lib/pdf-upload";
import { parseQuestionCount } from "@/lib/question-count";
import { currentUserId } from "@/lib/user";

function mlErrorStatus(code: string): number {
  if (code === "NOTES_TOO_LONG" || code === "UNSUPPORTED_PDF" || code === "PDF_PARSE_FAILED")
    return 422;
  if (code === "MODEL_TIMEOUT") return 504;
  if (code === "ML_SERVICE_UNAVAILABLE") return 503;
  return 502;
}

export async function POST(req: Request) {
  return handle(async () => {
    const userId = await currentUserId();
    const formData = await req.formData();

    const subjectId = (formData.get("subjectId") as string | null)?.trim() ?? "";
    if (!subjectId) return fail("subjectId is required.", 422);

    const countField = formData.get("count");
    const countParsed = parseQuestionCount(
      countField === null ? undefined : typeof countField === "string" ? countField : String(countField),
    );
    if (!countParsed.ok) return fail(countParsed.error, 422);
    const count = countParsed.count;
    const title = (formData.get("title") as string | null)?.trim() ?? "";

    const file = formData.get("file");
    if (!(file instanceof File)) return fail("No PDF file provided.", 422);
    const fileError = pdfUploadError(file);
    if (fileError) return fail(fileError, fileError === PDF_TOO_LARGE_MESSAGE ? 413 : 422);

    // Verify subject belongs to the current user before doing any ML work.
    const subject = await db.select().from(subjects).where(eq(subjects.id, subjectId)).get();
    if (!subject || subject.userId !== userId) return fail("Subject not found.", 404);

    // Demo mode is neither capped nor logged, matching /api/questions/generate.
    const demoMode = process.env.CALIBRATE_DEMO_MODE === "true";

    // Per-user daily cap protects the paid inference account.
    if (!demoMode) {
      const cap = await checkGenerationCap(userId);
      if (!cap.allowed) return fail(capMessage(cap.limit), 429);
    }

    const record: typeof recordGeneration = demoMode ? async () => {} : recordGeneration;

    // --- Step 1: parse PDF via FastAPI ---
    let parsed;
    try {
      parsed = await parsePdf(file, file.name);
    } catch (err) {
      if (err instanceof MlServiceError) {
        await record({ userId, kind: "pdf", ok: false, errorCode: err.code });
        return fail(err.studentMessage, mlErrorStatus(err.code));
      }
      await record({ userId, kind: "pdf", ok: false, errorCode: "UNEXPECTED" });
      throw err;
    }

    if (!parsed.text.trim()) {
      await record({ userId, kind: "pdf", ok: false, errorCode: "UNSUPPORTED_PDF" });
      return fail(
        "This PDF appears to be scanned or empty. Try a text-based PDF or paste your notes instead.",
        422,
      );
    }

    // --- Step 2: generate questions (FastAPI, or the explicit demo generator) ---
    // Generation runs before the material is saved so a failed generation
    // cannot leave an empty material behind for the student to clean up.
    let generated;
    if (demoMode) {
      generated = generateDemoQuestions(parsed.text, count);
    } else {
      try {
        generated = await generateQuestions({
          subject: subject.name,
          text: parsed.text,
          requestedCount: count,
        });
      } catch (err) {
        if (err instanceof MlServiceError) {
          await record({ userId, kind: "pdf", ok: false, errorCode: err.code });
          return fail(err.studentMessage, mlErrorStatus(err.code));
        }
        await record({ userId, kind: "pdf", ok: false, errorCode: "UNEXPECTED" });
        throw err;
      }
    }

    if (!generated.length) {
      await record({ userId, kind: "pdf", ok: false, errorCode: "NO_GROUNDED_QUESTIONS" });
      return fail(
        "We couldn’t generate grounded questions from this material. Try adding more detailed notes or a different text-based PDF.",
        422,
      );
    }

    // --- Step 3: persist Material ---
    const materialId = newId("mat");
    const materialTitle =
      title || parsed.file_name.replace(/\.pdf$/i, "").trim() || "Untitled PDF";

    await db.insert(materials)
      .values({
        id: materialId,
        userId,
        subjectId,
        title: materialTitle,
        content: parsed.text,
        createdAt: new Date().toISOString(),
      })
      .run();

    // --- Step 4: persist Questions ---
    const rows = generated.map((q) => ({
      id: newId("q"),
      userId,
      subjectId,
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

    await db.insert(questions).values(rows).run();
    await record({ userId, kind: "pdf", ok: true, questionCount: rows.length });

    return ok(
      {
        provider: demoMode ? "calibrate-demo" : "calibrate-ml",
        materialId,
        questionCount: rows.length,
        requestedCount: count,
        questions: rows,
      },
      201,
    );
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
