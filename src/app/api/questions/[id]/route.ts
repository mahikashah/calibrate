import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema";
import { handle, ok } from "@/lib/http";
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

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
