import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { outcomes, sessionFeedback, sessions, subjects } from "@/lib/db/schema";
import { handle, ok } from "@/lib/http";
import { withFallback } from "@/lib/llm";
import { computeInsights, type EvidenceRecord } from "@/lib/recommend";
import { currentUserId } from "@/lib/user";

export async function GET() {
  return handle(async () => {
    const userId = currentUserId();

    // One row per outcome-checked session: this IS the evidence base.
    const rows = db
      .select({
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
      .where(eq(sessions.userId, userId))
      .all() as EvidenceRecord[];

    const report = computeInsights(rows);

    // AI only phrases the numbers we already computed.
    const summarizeInput = {
      subjects: report.subjects.map((s) => ({
        subjectName: s.subjectName,
        confidence: s.confidence,
        bestTechnique: s.best?.label,
        bestScore: s.best?.avgScore,
        headline: s.headline,
      })),
      totalSessions: report.overall.totalSessions,
      totalMinutes: report.overall.totalMinutes,
    };
    const { result: summary, provider, fellBack } = await withFallback((p) =>
      p.summarizeInsights(summarizeInput),
    );

    return ok({ report, summary, summaryProvider: provider, fellBack });
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
