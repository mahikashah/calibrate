import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionFeedback, sessions } from "@/lib/db/schema";
import { fail, handle, ok } from "@/lib/http";
import { newId } from "@/lib/ids";
import { currentUserId } from "@/lib/user";

const reasonValues = [
  "technique_wrong",
  "questions_wrong",
  "material_hard",
  "distracted_low_energy",
  "not_sure",
] as const;

const FeedbackInput = z.object({
  sessionId: z.string().min(1),
  overall: z.enum(["rough", "good"]),
  calmWired: z.number().int().min(0).max(100),
  reasons: z.array(z.enum(reasonValues)).max(reasonValues.length).default([]),
});

function ownedCompletedSession(sessionId: string, userId: string) {
  return db.select().from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .get();
}

export async function GET(req: Request) {
  return handle(async () => {
    const sessionId = new URL(req.url).searchParams.get("sessionId");
    if (!sessionId) return fail("Choose a completed study session first.", 400);
    const session = ownedCompletedSession(sessionId, currentUserId());
    if (!session) return fail("Study session not found.", 404);
    if (!session.endedAt) return fail("Finish this study session before adding feedback.", 409);
    const feedback = db.select().from(sessionFeedback).where(eq(sessionFeedback.sessionId, sessionId)).get() ?? null;
    return ok({ session, feedback });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const body = FeedbackInput.parse(await req.json());
    const session = ownedCompletedSession(body.sessionId, currentUserId());
    if (!session) return fail("Study session not found.", 404);
    if (!session.endedAt) return fail("Finish this study session before adding feedback.", 409);
    const values = { overall: body.overall, calmWired: body.calmWired, reasons: JSON.stringify([...new Set(body.reasons)]) };
    const existing = db.select().from(sessionFeedback).where(eq(sessionFeedback.sessionId, session.id)).get();
    if (existing) {
      db.update(sessionFeedback).set(values).where(eq(sessionFeedback.id, existing.id)).run();
      return ok({ feedback: { ...existing, ...values } });
    }
    const feedback = { id: newId("sfb"), sessionId: session.id, ...values, createdAt: new Date().toISOString() };
    db.insert(sessionFeedback).values(feedback).run();
    return ok({ feedback }, 201);
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";