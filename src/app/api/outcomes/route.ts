import { z } from "zod";
import { db } from "@/lib/db";
import { outcomes } from "@/lib/db/schema";
import { handle, ok } from "@/lib/http";
import { newId } from "@/lib/ids";

const CreateOutcome = z.object({
  sessionId: z.string().min(1),
  quizScore: z.number().min(0).max(100),
  confidence: z.number().int().min(1).max(5),
  recall: z.number().min(0).max(100),
  notes: z.string().default(""),
});

export async function POST(req: Request) {
  return handle(async () => {
    const body = CreateOutcome.parse(await req.json());
    const row = {
      id: newId("out"),
      sessionId: body.sessionId,
      quizScore: body.quizScore,
      confidence: body.confidence,
      recall: body.recall,
      notes: body.notes,
      createdAt: new Date().toISOString(),
    };
    db.insert(outcomes).values(row).run();
    return ok(row, 201);
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
