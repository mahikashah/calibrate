import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema";
import { fail, handle, ok } from "@/lib/http";
import { currentUserId } from "@/lib/user";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const userId = currentUserId();
    const { id } = params;

    const existing = db
      .select({ id: questions.id })
      .from(questions)
      .where(and(eq(questions.id, id), eq(questions.userId, userId)))
      .get();

    if (!existing) {
      return new Response(JSON.stringify({ error: "Question not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    db.delete(questions).where(eq(questions.id, id)).run();
    return ok({ deleted: id });
  });
}

const UpdateQuestion = z.object({
  action: z.enum(["approve", "reject", "edit"]),
  prompt: z.string().min(1).max(5000).optional(),
  answer: z.string().min(1).max(5000).optional(),
  answerChoices: z.array(z.string().trim().min(1)).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const body = UpdateQuestion.parse(await req.json());
    const userId = currentUserId();
    const existing = db
      .select()
      .from(questions)
      .where(and(eq(questions.id, params.id), eq(questions.userId, userId)))
      .get();

    if (!existing) return fail("Question not found.", 404);

    if (body.action === "approve" || body.action === "reject") {
      const status = body.action === "approve" ? "approved" : "rejected";
      db.update(questions).set({ status }).where(eq(questions.id, existing.id)).run();
    } else {
      if (!body.prompt || !body.answer) {
        return fail("Question text and answer are required.", 422);
      }
      const answerChoices = body.answerChoices ?? JSON.parse(existing.answerChoices ?? "[]");
      if (existing.type === "mcq") {
        if (answerChoices.length !== 4 || answerChoices.some((choice: string) => !choice.trim())) {
          return fail("Multiple-choice questions need exactly four answer choices.", 422);
        }
        if (!answerChoices.includes(body.answer)) {
          return fail("The correct answer must match one of the answer choices.", 422);
        }
      } else if (answerChoices.length > 0) {
        return fail("Only multiple-choice questions can have answer choices.", 422);
      }
      db.update(questions)
        .set({
          prompt: body.prompt.trim(),
          answer: body.answer.trim(),
          answerChoices: JSON.stringify(answerChoices),
          status: "edited",
        })
        .where(eq(questions.id, existing.id))
        .run();
    }

    const updated = db.select().from(questions).where(eq(questions.id, existing.id)).get();
    return ok(updated);
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
