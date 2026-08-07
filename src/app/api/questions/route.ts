import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema";
import { fail, handle, ok } from "@/lib/http";
import { newId } from "@/lib/ids";
import { currentUserId } from "@/lib/user";

export async function GET(req: Request) {
  return handle(async () => {
    const userId = currentUserId();
    const subjectId = new URL(req.url).searchParams.get("subjectId");
    const rows = db
      .select()
      .from(questions)
      .where(
        subjectId
          ? and(eq(questions.userId, userId), eq(questions.subjectId, subjectId))
          : eq(questions.userId, userId),
      )
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
