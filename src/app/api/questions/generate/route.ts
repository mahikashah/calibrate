import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { materials, questions, subjects } from "@/lib/db/schema";
import { handle, ok, fail } from "@/lib/http";
import { newId } from "@/lib/ids";
import { withFallback } from "@/lib/llm";
import { currentUserId } from "@/lib/user";

const GenerateReq = z.object({
  subjectId: z.string().min(1),
  subjectName: z.string().optional(),
  materialId: z.string().optional(),
  materialText: z.string().optional(),
  count: z.number().int().min(1).max(15).default(5),
  save: z.boolean().default(true),
});

export async function POST(req: Request) {
  return handle(async () => {
    const body = GenerateReq.parse(await req.json());
    const userId = currentUserId();

    const subject = db.select().from(subjects).where(eq(subjects.id, body.subjectId)).get();
    if (!subject || subject.userId !== userId) return fail("Subject not found.", 404);

    let material = body.materialText ?? "";
    if (body.materialId) {
      const m = db.select().from(materials).where(eq(materials.id, body.materialId)).get();
      if (!m || m.userId !== userId) return fail("Material not found.", 404);
      if (!material) material = m.content;
    }
    if (!material.trim()) return fail("Provide materialText or a materialId with content.", 422);

    const { result, provider, fellBack } = await withFallback((p) =>
      p.generateQuestions({ material, subject: body.subjectName, count: body.count }),
    );

    const rows = result.map((q) => ({
      id: newId("q"),
      userId,
      subjectId: body.subjectId,
      materialId: body.materialId ?? null,
      type: q.type,
      prompt: q.prompt,
      answer: q.answer,
      source: "ai",
      createdAt: new Date().toISOString(),
    }));

    if (body.save && rows.length) db.insert(questions).values(rows).run();
    return ok({ provider, fellBack, questions: rows }, 201);
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
