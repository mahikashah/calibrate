/**
 * POST /api/pdf
 *
 * Accepts a PDF file upload from the browser, parses it via FastAPI, saves the
 * extracted text as a Material record, generates questions, saves them, and
 * returns the counts. The browser never talks to FastAPI directly.
 *
 * Form fields:
 *   file      — PDF binary (required)
 *   subjectId — string (required)
 *   title     — string (optional, defaults to file name)
 *   count     — integer 1-10 (optional, defaults to 6)
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { materials, questions, subjects } from "@/lib/db/schema";
import { handle, ok, fail } from "@/lib/http";
import { newId } from "@/lib/ids";
import { generateQuestions, parsePdf, MlServiceError } from "@/lib/ml-service";
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
    const userId = currentUserId();
    const formData = await req.formData();

    const subjectId = (formData.get("subjectId") as string | null)?.trim() ?? "";
    if (!subjectId) return fail("subjectId is required.", 422);

    const countRaw = parseInt((formData.get("count") as string | null) ?? "6", 10);
    const count = Number.isFinite(countRaw) ? Math.min(10, Math.max(1, countRaw)) : 6;
    const title = (formData.get("title") as string | null)?.trim() ?? "";

    const file = formData.get("file") as File | null;
    if (!file) return fail("No PDF file provided.", 422);

    // Verify subject belongs to the current user before doing any ML work.
    const subject = db.select().from(subjects).where(eq(subjects.id, subjectId)).get();
    if (!subject || subject.userId !== userId) return fail("Subject not found.", 404);

    // --- Step 1: parse PDF via FastAPI ---
    let parsed;
    try {
      parsed = await parsePdf(file, file.name);
    } catch (err) {
      if (err instanceof MlServiceError) {
        return fail(err.studentMessage, mlErrorStatus(err.code));
      }
      throw err;
    }

    if (!parsed.text.trim()) {
      return fail(
        "This PDF appears to be scanned or empty. Try a text-based PDF or paste your notes instead.",
        422,
      );
    }

    // --- Step 2: generate questions via FastAPI ---
    // Generation runs before the material is saved so a failed generation
    // cannot leave an empty material behind for the student to clean up.
    let generated;
    try {
      generated = await generateQuestions({
        subject: subject.name,
        text: parsed.text,
        requestedCount: count,
      });
    } catch (err) {
      if (err instanceof MlServiceError) {
        return fail(err.studentMessage, mlErrorStatus(err.code));
      }
      throw err;
    }

    // --- Step 3: persist Material ---
    const materialId = newId("mat");
    const materialTitle =
      title || parsed.file_name.replace(/\.pdf$/i, "").trim() || "Untitled PDF";

    db.insert(materials)
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

    if (rows.length) db.insert(questions).values(rows).run();

    return ok({ materialId, questionCount: rows.length, questions: rows }, 201);
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
