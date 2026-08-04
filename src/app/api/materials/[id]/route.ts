import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { materials, questions } from "@/lib/db/schema";
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
      .select({ id: materials.id })
      .from(materials)
      .where(and(eq(materials.id, id), eq(materials.userId, userId)))
      .get();

    if (!existing) {
      return new Response(JSON.stringify({ error: "Material not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Cascade: delete only this user's questions linked to this material.
    db.delete(questions).where(and(eq(questions.materialId, id), eq(questions.userId, userId))).run();
    db.delete(materials).where(eq(materials.id, id)).run();

    return ok({ deleted: id });
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
