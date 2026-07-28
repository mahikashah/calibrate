import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema";
import { handle, ok } from "@/lib/http";
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
