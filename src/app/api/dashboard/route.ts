import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  materials,
  onboarding,
  outcomes,
  questions,
  sessionFeedback,
  sessions,
  subjects,
} from "@/lib/db/schema";
import { FEEDBACK_LABELS, parseReasons } from "@/lib/feedback-context";
import { handle, ok } from "@/lib/http";
import { computeInsights, currentRecommendation, type EvidenceRecord } from "@/lib/recommend";
import { outcomeScore } from "@/lib/stats";
import { techniqueLabel } from "@/lib/techniques";
import { currentUserId } from "@/lib/user";

/**
 * The Dashboard read model.
 *
 * Every number below comes from REAL evidence (`evidence_origin = 'real'`);
 * seeded presentation sessions are excluded from counts, the recent session,
 * evidence progress and the recommendation. The recommendation itself is not
 * computed here — it is the same deterministic `computeInsights` +
 * `currentRecommendation` pair Insights renders.
 */

const REVIEWABLE_STATUSES = new Set(["generated", "edited"]);

function hypothesisTechnique(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as { ranked?: { label?: string }[] };
    return parsed.ranked?.[0]?.label;
  } catch {
    return undefined;
  }
}

export async function GET() {
  return handle(async () => {
    const userId = currentUserId();

    const subjectRows = db
      .select({ id: subjects.id, name: subjects.name, color: subjects.color })
      .from(subjects)
      .where(eq(subjects.userId, userId))
      .orderBy(asc(subjects.name))
      .all();

    const materialRows = db
      .select({ id: materials.id, subjectId: materials.subjectId })
      .from(materials)
      .where(eq(materials.userId, userId))
      .all();

    const questionRows = db
      .select({ subjectId: questions.subjectId, status: questions.status })
      .from(questions)
      .where(eq(questions.userId, userId))
      .all();

    // Real, finished sessions only — this is the evidence progress base.
    const completedRows = db
      .select({
        id: sessions.id,
        subjectId: sessions.subjectId,
        technique: sessions.technique,
        minutes: sessions.actualMinutes,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          eq(sessions.evidenceOrigin, "real"),
          isNotNull(sessions.endedAt),
        ),
      )
      .all();

    // Real outcome checks — the exact same evidence rows /api/insights feeds to
    // computeInsights (one record per outcome check, so a session re-checked
    // later contributes twice). This query must stay identical to the Insights
    // one: any divergence would give the student two different recommendations.
    const evidenceRows = db
      .select({
        subjectId: sessions.subjectId,
        subjectName: subjects.name,
        technique: sessions.technique,
        minutes: sessions.actualMinutes,
        createdAt: outcomes.createdAt,
        quizScore: outcomes.quizScore,
        confidence: outcomes.confidence,
        recall: outcomes.recall,
      })
      .from(outcomes)
      .innerJoin(sessions, eq(outcomes.sessionId, sessions.id))
      .innerJoin(subjects, eq(sessions.subjectId, subjects.id))
      .where(and(eq(sessions.userId, userId), eq(sessions.evidenceOrigin, "real")))
      .orderBy(desc(outcomes.createdAt))
      .all();

    const evidence: EvidenceRecord[] = evidenceRows.map((row) => ({ ...row }));
    const report = computeInsights(evidence);

    const onboardingRow = db
      .select({ hypothesis: onboarding.hypothesis, createdAt: onboarding.createdAt })
      .from(onboarding)
      .where(eq(onboarding.userId, userId))
      .orderBy(desc(onboarding.createdAt))
      .get();
    const startingHypothesis = hypothesisTechnique(onboardingRow?.hypothesis);

    const focusSubject = report.subjects[0];
    const recommendation = currentRecommendation(focusSubject, startingHypothesis);

    // --- Latest real completed session -------------------------------------
    const recentRow = db
      .select({
        sessionId: sessions.id,
        subjectId: sessions.subjectId,
        subjectName: subjects.name,
        technique: sessions.technique,
        minutes: sessions.actualMinutes,
        endedAt: sessions.endedAt,
        startedAt: sessions.startedAt,
        quizScore: outcomes.quizScore,
        confidence: outcomes.confidence,
        recall: outcomes.recall,
        feedbackOverall: sessionFeedback.overall,
        calmWired: sessionFeedback.calmWired,
        feedbackReasons: sessionFeedback.reasons,
      })
      .from(sessions)
      .innerJoin(subjects, eq(sessions.subjectId, subjects.id))
      .leftJoin(outcomes, eq(outcomes.sessionId, sessions.id))
      .leftJoin(sessionFeedback, eq(sessionFeedback.sessionId, sessions.id))
      .where(
        and(
          eq(sessions.userId, userId),
          eq(sessions.evidenceOrigin, "real"),
          isNotNull(sessions.endedAt),
        ),
      )
      .orderBy(desc(sessions.endedAt), desc(sessions.startedAt), desc(outcomes.createdAt))
      .get();

    const recentReasons = parseReasons(recentRow?.feedbackReasons ?? null);
    const recentSession = recentRow
      ? {
          sessionId: recentRow.sessionId,
          subjectId: recentRow.subjectId,
          subjectName: recentRow.subjectName,
          technique: recentRow.technique,
          techniqueLabel: techniqueLabel(recentRow.technique),
          minutes: recentRow.minutes,
          completedAt: recentRow.endedAt ?? recentRow.startedAt,
          performance:
            recentRow.quizScore === null || recentRow.confidence === null || recentRow.recall === null
              ? null
              : outcomeScore({
                  quizScore: recentRow.quizScore,
                  confidence: recentRow.confidence,
                  recall: recentRow.recall,
                }),
          feedbackOverall: recentRow.feedbackOverall,
          calmWired: recentRow.calmWired,
          context: recentReasons.map((reason) => ({
            reason,
            label: FEEDBACK_LABELS[reason] ?? reason,
          })),
        }
      : null;

    // --- Evidence progress (real only) -------------------------------------
    const evidenceProgress = {
      completedSessions: completedRows.length,
      /** Outcome checks, not sessions — a session re-checked later adds another. */
      outcomeChecks: evidence.length,
      techniquesTried: new Set(completedRows.map((row) => row.technique)).size,
      subjectsWithEvidence: new Set(evidence.map((row) => row.subjectId)).size,
      focusedMinutes: completedRows.reduce((total, row) => total + row.minutes, 0),
    };

    // --- Subject summary ----------------------------------------------------
    const subjectSummary = subjectRows.map((subject) => ({
      ...subject,
      materialCount: materialRows.filter((row) => row.subjectId === subject.id).length,
      approvedQuestions: questionRows.filter(
        (row) => row.subjectId === subject.id && row.status === "approved",
      ).length,
      questionsAwaitingReview: questionRows.filter(
        (row) => row.subjectId === subject.id && REVIEWABLE_STATUSES.has(row.status),
      ).length,
      completedSessions: completedRows.filter((row) => row.subjectId === subject.id).length,
    }));

    const totals = {
      subjects: subjectRows.length,
      materials: materialRows.length,
      approvedQuestions: questionRows.filter((row) => row.status === "approved").length,
      questionsAwaitingReview: questionRows.filter((row) => REVIEWABLE_STATUSES.has(row.status))
        .length,
    };

    // --- Primary next action ------------------------------------------------
    const subjectNeedingMaterial = subjectSummary.find((subject) => subject.materialCount === 0);
    const nextAction = (() => {
      if (totals.subjects === 0) {
        return {
          id: "create_subject" as const,
          title: "Set up your first subject",
          description: "Calibrate needs a subject before it can test anything with you.",
          ctaLabel: "Create a subject",
          href: "/subjects",
        };
      }
      if (totals.materials === 0) {
        return {
          id: "add_material" as const,
          title: "Add study material",
          description: "Upload or paste material so Calibrate can build questions from it.",
          ctaLabel: "Add material",
          href: subjectNeedingMaterial
            ? `/subjects/${subjectNeedingMaterial.id}/materials/new`
            : "/subjects",
        };
      }
      if (totals.approvedQuestions === 0) {
        return {
          id: "review_questions" as const,
          title: "Review your Question Bank",
          description:
            totals.questionsAwaitingReview > 0
              ? `${totals.questionsAwaitingReview} question${totals.questionsAwaitingReview === 1 ? "" : "s"} are waiting for your approval.`
              : "Approve some questions so a study session has something to test you on.",
          ctaLabel: "Review Question Bank",
          href: "/questions",
        };
      }
      if (evidenceProgress.completedSessions === 0) {
        return {
          id: "start_session" as const,
          title: "Start your first study session",
          description: "One checked session is all it takes to begin collecting real evidence.",
          ctaLabel: "Start study session",
          href: "/study",
        };
      }
      if (recommendation.state === "hypothesis" || recommendation.state === "gathering") {
        return {
          id: "try_another_technique" as const,
          title: "Try another study technique",
          description:
            "There isn't enough comparison yet. Running a different technique makes the next read meaningful.",
          ctaLabel: "Start a comparison session",
          href: "/study",
        };
      }
      return {
        id: "study_recommendation" as const,
        title: recommendation.technique
          ? `Study with ${recommendation.technique}`
          : "Study with your current recommendation",
        description: "Your evidence has a leader. Keep testing it in comparable sessions.",
        ctaLabel: "Start study session",
        href: "/study",
      };
    })();

    return ok({
      nextAction,
      recommendation,
      focusSubject: focusSubject
        ? {
            subjectId: focusSubject.subjectId,
            subjectName: focusSubject.subjectName,
            confidence: focusSubject.confidence,
          }
        : null,
      evidenceProgress,
      recentSession,
      subjects: subjectSummary,
      totals,
      onboarding: { completed: Boolean(onboardingRow), startingHypothesis: startingHypothesis ?? null },
    });
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
