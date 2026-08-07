"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getJSON } from "@/lib/client";
import type { ConfidenceLevel, CurrentRecommendation } from "@/lib/recommend";

/**
 * The Calibrate home screen.
 *
 * It answers five questions and nothing more: what to do next, what the
 * evidence currently suggests, how much real evidence exists, what happened
 * last time, and where to go next. Every figure comes from /api/dashboard,
 * which reads real (non-seeded) evidence only and reuses the same
 * deterministic recommendation Insights shows.
 */

interface SubjectSummary {
  id: string;
  name: string;
  color: string;
  materialCount: number;
  approvedQuestions: number;
  questionsAwaitingReview: number;
  completedSessions: number;
}

interface RecentSession {
  sessionId: string;
  subjectName: string;
  techniqueLabel: string;
  minutes: number;
  completedAt: string;
  performance: number | null;
  feedbackOverall: "rough" | "good" | null;
  calmWired: number | null;
  context: { reason: string; label: string }[];
}

interface DashboardResponse {
  nextAction: { id: string; title: string; description: string; ctaLabel: string; href: string };
  recommendation: CurrentRecommendation;
  focusSubject: { subjectId: string; subjectName: string; confidence: ConfidenceLevel } | null;
  evidenceProgress: {
    completedSessions: number;
    outcomeChecks: number;
    techniquesTried: number;
    subjectsWithEvidence: number;
    focusedMinutes: number;
  };
  recentSession: RecentSession | null;
  subjects: SubjectSummary[];
  totals: {
    subjects: number;
    materials: number;
    approvedQuestions: number;
    questionsAwaitingReview: number;
  };
  onboarding: { completed: boolean; startingHypothesis: string | null };
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getJSON<DashboardResponse>("/api/dashboard")
      .then((response) => alive && setData(response))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (loading && !data) return <PageSkeleton />;
  if (!data) return null;

  const { nextAction, recommendation, evidenceProgress, recentSession, subjects, onboarding } = data;

  return (
    <div className="animate-rise space-y-7">
      <header className="max-w-2xl">
        <p className="label mb-2">Dashboard</p>
        <h1 className="text-3xl font-semibold tracking-tight">Find what actually works for you</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          One next step at a time, backed by your own study results — never a fixed label.
        </p>
      </header>

      {/* 1 — Primary next action: the most prominent thing on the page. */}
      <section className="graph-paper card overflow-hidden">
        <div className="p-6 sm:p-8">
          <p className="label mb-2">Next step</p>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{nextAction.title}</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">{nextAction.description}</p>
          <Link href={nextAction.href} className="btn-primary mt-6">
            {nextAction.ctaLabel} →
          </Link>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        {/* 2 — Current recommendation (reused from the Insights engine). */}
        <section className="rounded-xl border border-[#B9CCB5] bg-[#F3F8F0] p-6">
          <p className="label text-[#4D6E52]">Current recommendation</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">{recommendation.title}</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink">{recommendation.body}</p>
          {data.focusSubject && (
            <p className="mt-3 text-xs text-muted">
              Based on your evidence in {data.focusSubject.subjectName}.
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Link href="/insights" className="text-sm font-medium text-brand hover:underline">
              View why →
            </Link>
            {!onboarding.completed && (
              <Link href="/onboarding" className="text-sm font-medium text-brand hover:underline">
                Set a starting hypothesis →
              </Link>
            )}
          </div>
        </section>

        {/* 3 — Evidence progress, real evidence only. */}
        <section className="rounded-xl border border-line bg-white p-6">
          <p className="label">Evidence collected</p>
          <div className="mt-4 space-y-3">
            <ProgressRow
              value={evidenceProgress.completedSessions}
              label={`completed session${evidenceProgress.completedSessions === 1 ? "" : "s"}`}
            />
            <ProgressRow
              value={evidenceProgress.techniquesTried}
              label={`technique${evidenceProgress.techniquesTried === 1 ? "" : "s"} tried`}
            />
            <ProgressRow
              value={evidenceProgress.outcomeChecks}
              label={`outcome check${evidenceProgress.outcomeChecks === 1 ? "" : "s"} recorded`}
            />
          </div>
          <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-muted">
            Counts your own sessions only. Example presentation data never appears here.
          </p>
        </section>
      </div>

      {/* 4 — Latest real session. */}
      <section className="rounded-xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="label">Latest session</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">What happened last time</h2>
          </div>
          <Link href="/insights" className="text-sm font-medium text-brand hover:underline">
            Full insights →
          </Link>
        </div>

        {recentSession ? (
          <article className="mt-5 rounded-lg border border-line p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{recentSession.techniqueLabel}</p>
                <p className="mt-1 text-xs text-muted">
                  {recentSession.subjectName} ·{" "}
                  {new Date(recentSession.completedAt).toLocaleDateString()} ·{" "}
                  {recentSession.minutes} focused min
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#EEF6F5] px-2.5 py-1 text-xs font-semibold text-[#167978]">
                  {recentSession.performance === null
                    ? "No outcome check"
                    : `${recentSession.performance}/100`}
                </span>
                {recentSession.feedbackOverall && (
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      recentSession.feedbackOverall === "good"
                        ? "bg-[#F0F7EC] text-[#4D6E52]"
                        : "bg-[#FFF3E7] text-[#9A5B19]"
                    }`}
                  >
                    {recentSession.feedbackOverall === "good" ? "Good" : "Rough"}
                  </span>
                )}
              </div>
            </div>
            {(recentSession.context.length > 0 || recentSession.calmWired !== null) && (
              <div className="mt-3 border-t border-line pt-3">
                <div className="flex flex-wrap gap-2">
                  {recentSession.context.map((item) => (
                    <span
                      key={item.reason}
                      className="rounded-full border border-line px-2.5 py-1 text-xs text-muted"
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  Context you reported, not a conclusion about the technique.
                </p>
              </div>
            )}
            {recentSession.context.some((item) => item.reason === "questions_wrong") && (
              <Link
                href="/questions"
                className="mt-3 inline-flex text-sm font-medium text-brand hover:underline"
              >
                Review Question Bank quality →
              </Link>
            )}
          </article>
        ) : (
          <p className="mt-4 text-sm text-muted">
            No completed sessions yet. Your first one shows up here with its result and any context
            you add.
          </p>
        )}
      </section>

      {/* 5 — Subjects, compact. */}
      <section className="rounded-xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="label">Subjects</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">What you're studying</h2>
          </div>
          <Link href="/subjects" className="text-sm font-medium text-brand hover:underline">
            View all subjects →
          </Link>
        </div>
        {subjects.length > 0 ? (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {subjects.slice(0, 4).map((subject) => (
              <li key={subject.id} className="rounded-lg border border-line p-4">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: subject.color }}
                    aria-hidden
                  />
                  <p className="font-semibold text-ink">{subject.name}</p>
                </div>
                <p className="mt-2 text-xs text-muted">
                  {plural(subject.materialCount, "material")} ·{" "}
                  {plural(subject.approvedQuestions, "approved question")} ·{" "}
                  {plural(subject.completedSessions, "session")}
                </p>
                {subject.questionsAwaitingReview > 0 && (
                  <p className="mt-1 text-xs text-[#9A5B19]">
                    {plural(subject.questionsAwaitingReview, "question")} awaiting review
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">
            No subjects yet — creating one is your next step above.
          </p>
        )}
      </section>

      {/* 6 — Shortcuts. */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Shortcut href="/questions" title="Question Bank" hint="Review and approve questions" />
        <Shortcut href="/study" title="Study" hint="Run a session with a technique" />
        <Shortcut href="/insights" title="Full insights" hint="See the evidence behind it" />
      </section>
    </div>
  );
}

function ProgressRow({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="stat text-2xl font-semibold tracking-tight text-ink">{value}</span>
      <span className="text-sm text-muted">{label}</span>
    </div>
  );
}

function Shortcut({ href, title, hint }: { href: string; title: string; hint: string }) {
  return (
    <Link href={href} className="index-card flex flex-col gap-1 p-4">
      <span className="text-sm font-semibold text-ink">{title} →</span>
      <span className="text-xs text-muted">{hint}</span>
    </Link>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-7">
      <div className="h-9 w-72 animate-pulse rounded bg-line" />
      <div className="h-44 animate-pulse rounded-xl bg-line" />
      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="h-40 animate-pulse rounded-xl bg-line" />
        <div className="h-40 animate-pulse rounded-xl bg-line" />
      </div>
      <div className="h-40 animate-pulse rounded-xl bg-line" />
    </div>
  );
}
