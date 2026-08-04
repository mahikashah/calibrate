import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { materials, questions, subjects } from "@/lib/db/schema";
import { fail, handle, ok } from "@/lib/http";
import { currentUserId } from "@/lib/user";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const userId = currentUserId();
    const { id } = params;

    // Confirm the subject belongs to the current user.
    const subject = db
      .select()
      .from(subjects)
      .where(eq(subjects.id, id))
      .get();

    if (!subject || subject.userId !== userId) {
      return fail("Subject not found", 404);
    }

    // Block deletion when linked questions exist.
    const linkedQuestion = db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.subjectId, id))
      .get();

    if (linkedQuestion) {
      return fail(
        "Cannot delete a subject that still has saved questions. Delete the questions first.",
        409,
      );
    }

    // Block deletion when linked materials exist.
    const linkedMaterial = db
      .select({ id: materials.id })
      .from(materials)
      .where(eq(materials.subjectId, id))
      .get();

    if (linkedMaterial) {
      return fail(
        "Cannot delete a subject that still has saved materials. Delete the materials first.",
        409,
      );
    }

    db.delete(subjects).where(eq(subjects.id, id)).run();
    return ok({ id });
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
