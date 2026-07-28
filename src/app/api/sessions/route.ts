import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { outcomes, sessions } from "@/lib/db/schema";
import { handle, ok } from "@/lib/http";
import { newId } from "@/lib/ids";
import { currentUserId } from "@/lib/user";

export async function GET() {
  return handle(async () => {
    const userId = currentUserId();
    const rows = db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.startedAt))
      .all();
    return ok(rows);
  });
}

const OutcomeInput = z.object({
  quizScore: z.number().min(0).max(100),
  confidence: z.number().int().min(1).max(5),
  recall: z.number().min(0).max(100),
  notes: z.string().default(""),
});

const CreateSession = z.object({
  subjectId: z.string().min(1),
  technique: z.string().min(1),
  materialId: z.string().nullish(),
  plannedMinutes: z.number().int().min(1).max(240).default(25),
  actualMinutes: z.number().int().min(0).max(600).default(25),
  notes: z.string().default(""),
  // A session can be logged together with its outcome check in one call.
  outcome: OutcomeInput.optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const body = CreateSession.parse(await req.json());
    const userId = currentUserId();
    const nowIso = new Date().toISOString();

    const session = {
      id: newId("ses"),
      userId,
      subjectId: body.subjectId,
      technique: body.technique,
      materialId: body.materialId ?? null,
      plannedMinutes: body.plannedMinutes,
      actualMinutes: body.actualMinutes,
      notes: body.notes,
      startedAt: nowIso,
      endedAt: nowIso,
    };
    db.insert(sessions).values(session).run();

    let outcome = null;
    if (body.outcome) {
      outcome = {
        id: newId("out"),
        sessionId: session.id,
        quizScore: body.outcome.quizScore,
        confidence: body.outcome.confidence,
        recall: body.outcome.recall,
        notes: body.outcome.notes,
        createdAt: nowIso,
      };
      db.insert(outcomes).values(outcome).run();
    }

    return ok({ session, outcome }, 201);
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
