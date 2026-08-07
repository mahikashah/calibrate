import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { outcomes, sessionFeedback, sessions, subjects } from "@/lib/db/schema";
import { fail, handle, ok } from "@/lib/http";
import { computeInsights, type EvidenceRecord } from "@/lib/recommend";
import { outcomeScore } from "@/lib/stats";
import { techniqueLabel } from "@/lib/techniques";
import { currentUserId } from "@/lib/user";

const feedbackMessages: Record<string, string> = {
  questions_wrong: "Question quality may have affected this session.",
  material_hard: "Material difficulty may have influenced this session.",
  distracted_low_energy: "Session conditions may have influenced this session.",
  technique_wrong: "You felt the technique may not have fit this session.",
  not_sure: "You were not sure what affected this session.",
};

function parseReasons(value: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((reason): reason is string => typeof reason === "string") : [];
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  return handle(async () => {
    const userId = currentUserId();
    const params = new URL(req.url).searchParams;
    const source = params.get("source") === "demo" ? "demo" : "real";
    const subjectId = params.get("subjectId");

    if (subjectId) {
      const subject = db
        .select({ id: subjects.id })
        .from(subjects)
        .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
        .get();
      if (!subject) return fail("Subject not found", 404);
    }

    const rows = db
      .select({
        sessionId: sessions.id,
        subjectId: sessions.subjectId,
        subjectName: subjects.name,
        technique: sessions.technique,
        minutes: sessions.actualMinutes,
        createdAt: outcomes.createdAt,
        quizScore: outcomes.quizScore,
        confidence: outcomes.confidence,
        recall: outcomes.recall,
        feedbackOverall: sessionFeedback.overall,
        calmWired: sessionFeedback.calmWired,
        feedbackReasons: sessionFeedback.reasons,
      })
      .from(outcomes)
      .innerJoin(sessions, eq(outcomes.sessionId, sessions.id))
      .innerJoin(subjects, eq(sessions.subjectId, subjects.id))
      .leftJoin(sessionFeedback, eq(sessionFeedback.sessionId, sessions.id))
      .where(
        and(
          eq(sessions.userId, userId),
          eq(sessions.evidenceOrigin, source),
          subjectId ? eq(sessions.subjectId, subjectId) : undefined,
        ),
      )
      .orderBy(desc(outcomes.createdAt))
      .all();

    const evidence: EvidenceRecord[] = rows.map((row) => ({
      subjectId: row.subjectId,
      subjectName: row.subjectName,
      technique: row.technique,
      minutes: row.minutes,
      createdAt: row.createdAt,
      quizScore: row.quizScore,
      confidence: row.confidence,
      recall: row.recall,
    }));
    const report = computeInsights(evidence);
    const recentEvidence = rows.slice(0, 12).map((row) => {
      const reasons = parseReasons(row.feedbackReasons);
      return {
        sessionId: row.sessionId,
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        technique: row.technique,
        techniqueLabel: techniqueLabel(row.technique),
        minutes: row.minutes,
        createdAt: row.createdAt,
        outcomeScore: outcomeScore(row),
        feedbackOverall: row.feedbackOverall,
        calmWired: row.calmWired,
        feedbackReasons: reasons,
        context: reasons.map((reason) => ({ reason, message: feedbackMessages[reason] ?? reason })),
      };
    });

    return ok({
      source,
      sourceLabel: source === "real" ? "Your completed sessions" : "Presentation example data",
      report,
      subjects: db
        .select({ id: subjects.id, name: subjects.name })
        .from(subjects)
        .where(eq(subjects.userId, userId))
        .all(),
      recentEvidence,
    });
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
