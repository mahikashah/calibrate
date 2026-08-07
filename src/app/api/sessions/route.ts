import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { materials, outcomes, sessions, subjects } from "@/lib/db/schema";
import { fail, handle, ok } from "@/lib/http";
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
  completionKey: z.string().min(8).max(120).optional(),
  // A session can be logged together with its outcome check in one call.
  outcome: OutcomeInput.optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const body = CreateSession.parse(await req.json());
    const userId = currentUserId();
    const subject = db.select().from(subjects).where(and(eq(subjects.id, body.subjectId), eq(subjects.userId, userId))).get();
    if (!subject) return fail("Subject not found", 404);
    if (body.materialId) {
      const material = db.select().from(materials).where(and(eq(materials.id, body.materialId), eq(materials.userId, userId))).get();
      if (!material || material.subjectId !== body.subjectId) return fail("Material not found", 404);
    }
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
      completionKey: body.completionKey ?? null,
      startedAt: nowIso,
      endedAt: nowIso,
    };
    if (body.completionKey) {
      db.insert(sessions).values(session).onConflictDoNothing().run();
      const persisted = db.select().from(sessions).where(eq(sessions.completionKey, body.completionKey)).get();
      if (!persisted) return fail("We couldn’t save this session. Please try again.", 500);
      if (persisted.id !== session.id) {
        const existingOutcome = db.select().from(outcomes).where(eq(outcomes.sessionId, persisted.id)).get() ?? null;
        return ok({ session: persisted, outcome: existingOutcome }, 200);
      }
    } else {
      db.insert(sessions).values(session).run();
    }

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
