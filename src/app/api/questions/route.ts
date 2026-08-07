import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { materials, questions, subjects } from "@/lib/db/schema";
import { fail, handle, ok } from "@/lib/http";
import { newId } from "@/lib/ids";
import { currentUserId } from "@/lib/user";

export async function GET(req: Request) {
  return handle(async () => {
    const userId = currentUserId();
    const searchParams = new URL(req.url).searchParams;
    const subjectId = searchParams.get("subjectId");
    const materialId = searchParams.get("materialId");
    const approvedOnly = searchParams.get("status") === "approved";
    if (subjectId) {
      const subject = db.select().from(subjects).where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId))).get();
      if (!subject) return fail("Subject not found", 404);
    }
    if (materialId) {
      const material = db.select().from(materials).where(and(eq(materials.id, materialId), eq(materials.userId, userId))).get();
      if (!material || (subjectId && material.subjectId !== subjectId)) return fail("Material not found", 404);
    }
    const where = and(
      eq(questions.userId, userId),
      ...(subjectId ? [eq(questions.subjectId, subjectId)] : []),
      ...(materialId ? [eq(questions.materialId, materialId)] : []),
      ...(approvedOnly ? [eq(questions.status, "approved")] : []),
    );
    const rows = db
      .select()
      .from(questions)
      .where(where)
      .orderBy(desc(questions.createdAt))
      .all();
    return ok(rows);
  });
}

const BulkApprove = z.object({
  subjectId: z.string().min(1),
  materialId: z.string().nullish(),
});

export async function PATCH(req: Request) {
  return handle(async () => {
    const { subjectId, materialId } = BulkApprove.parse(await req.json());
    const userId = currentUserId();
    const where = and(
      eq(questions.userId, userId),
      eq(questions.subjectId, subjectId),
      ...(materialId ? [eq(questions.materialId, materialId)] : []),
      inArray(questions.status, ["generated", "edited"]),
    );
    const eligible = db.select({ id: questions.id }).from(questions).where(where).all();
    if (!eligible.length) return ok({ approved: 0 });
    db.update(questions).set({ status: "approved" }).where(where).run();
    return ok({ approved: eligible.length });
  });
}

const CreateQuestion = z.object({
  subjectId: z.string().min(1),
  materialId: z.string().nullish(),
  type: z.enum(["recall", "practice", "feynman", "cloze"]).default("recall"),
  prompt: z.string().min(1),
  answer: z.string().default(""),
});

export async function POST(req: Request) {
  return handle(async () => {
    const body = CreateQuestion.parse(await req.json());
    const row = {
      id: newId("q"),
      userId: currentUserId(),
      subjectId: body.subjectId,
      materialId: body.materialId ?? null,
      type: body.type,
      prompt: body.prompt.trim(),
      answer: body.answer,
      source: "user",
      createdAt: new Date().toISOString(),
    };
    db.insert(questions).values(row).run();
    return ok(row, 201);
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
