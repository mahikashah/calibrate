"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ConfidenceBadge, Empty } from "@/components/ui";
import { getJSON } from "@/lib/client";
import { currentRecommendation, type InsightsReport, type SubjectInsight } from "@/lib/recommend";

type Source = "real" | "demo";

interface RecentEvidence {
  sessionId: string;
  subjectId: string;
  subjectName: string;
  technique: string;
  techniqueLabel: string;
  minutes: number;
  createdAt: string;
  outcomeScore: number;
  feedbackOverall: "rough" | "good" | null;
  calmWired: number | null;
  feedbackReasons: string[];
  context: { reason: string; message: string }[];
}

interface InsightsResponse {
  source: Source;
  sourceLabel: string;
  report: InsightsReport;
  subjects: { id: string; name: string }[];
  recentEvidence: RecentEvidence[];
}

function hours(minutes: number) {
  return `${Math.round((minutes / 60) * 10) / 10}h`;
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<Source>("real");
  const [subjectId, setSubjectId] = useState("");
  const [showMath, setShowMath] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const query = new URLSearchParams({ source });
    if (subjectId) query.set("subjectId", subjectId);
    getJSON<InsightsResponse>(`/api/insights?${query}`)
      .then((response) => alive && setData(response))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [source, subjectId]);

  if (loading && !data) return <div className="h-64 animate-pulse rounded-xl bg-line" />;

  const report = data?.report;
  const hasData = Boolean(report?.subjects.length);
  const focusSubject = report?.subjects[0];
  const recommendation = currentRecommendation(focusSubject);
  const questionQualityFlagged = data?.recentEvidence.some((row) =>
    row.feedbackReasons.includes("questions_wrong"),
  );

  return (
    <div className="animate-rise space-y-7">
      <header className="max-w-2xl">
        <p className="label mb-2">Insights</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          What your study experiments are teaching you
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Compare recorded outcomes, not labels. Context stays visible so one rough session never tells the whole story.
        </p>
      </header>

      <section className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">Evidence source</p>
          <p className="text-xs text-muted">
            {source === "real"
              ? "Only sessions you complete in the study workflow count here."
              : "Seeded example history for exploring the presentation. It never affects your results."}
          </p>
        </div>
        <div className="flex rounded-lg border border-line bg-paper p-1 text-sm" role="group" aria-label="Evidence source">
          <button
            type="button"
            onClick={() => setSource("real")}
            aria-pressed={source === "real"}
            className={`min-h-10 rounded-md px-3 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${source === "real" ? "bg-brand text-white" : "text-muted hover:text-ink"}`}
          >
            My evidence
          </button>
          <button
            type="button"
            onClick={() => setSource("demo")}
            aria-pressed={source === "demo"}
            className={`min-h-10 rounded-md px-3 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${source === "demo" ? "bg-brand text-white" : "text-muted hover:text-ink"}`}
          >
            Example data
          </button>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <label className="label" htmlFor="insight-subject">Subject</label>
        <select
          id="insight-subject"
          value={subjectId}
          onChange={(event) => setSubjectId(event.target.value)}
          className="field max-w-xs"
        >
          <option value="">All subjects</option>
          {data?.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </select>
        {loading && <span className="text-xs text-muted">Refreshing evidence…</span>}
      </section>

      {!hasData ? (
        <Empty title={source === "real" ? "Still gathering evidence" : "No example evidence for this filter"}>
          {source === "real" ? (
            <>
              Complete a study session with an outcome check, then come back to compare techniques.{" "}
              <Link href="/study" className="font-medium text-brand hover:underline">Start study session</Link>
            </>
          ) : (
            "Choose another subject or switch back to My evidence."
          )}
        </Empty>
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
            <div className="card border-sage/40 bg-sage-soft/60 p-6">
              <p className="label text-sage-ink">Current recommendation</p>
              <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight">{recommendation.title}</h2>
              <div className="mt-4">
                <p className="label mb-1">Why?</p>
                <p className="max-w-xl text-sm leading-relaxed text-ink">{recommendation.body}</p>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/study" className="btn-primary min-h-11">
                  {recommendation.action}
                </Link>
                <Link href="/dashboard" className="btn-ghost min-h-11">
                  View Dashboard
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Tile label="Evidence count" value={report!.overall.totalSessions} />
              <Tile label="Focused time" value={hours(report!.overall.totalMinutes)} />
              <Tile label="Most practiced" value={report!.overall.mostUsedTechnique ?? "—"} small />
              <Tile label="Technique with 3+ sessions" value={report!.overall.bestOverallTechnique ?? "Still testing"} small />
            </div>
          </section>

          <section>
            <div className="mb-3">
              <p className="label">Technique comparison</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Recorded outcomes by subject</h2>
            </div>
            <div className="space-y-4">
              {report!.subjects.map((subject) => <SubjectPanel key={subject.subjectId} subject={subject} />)}
            </div>
          </section>

          <section className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="label">Recent sessions</p>
                <h2 className="mt-1 font-serif text-xl font-semibold tracking-tight">What happened lately</h2>
              </div>
              <span className="text-xs text-muted">Newest first · up to 12</span>
            </div>
            <div className="mt-5 space-y-3">
              {data!.recentEvidence.map((row) => (
                <article key={row.sessionId} className="rounded-lg border border-line bg-paper/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{row.techniqueLabel}</p>
                      <p className="mt-1 text-xs text-muted">{row.subjectName} · {new Date(row.createdAt).toLocaleDateString()} · {row.minutes} focused min</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-ink">{row.outcomeScore}/100</span>
                      {row.feedbackOverall && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.feedbackOverall === "good" ? "bg-sage-soft text-sage-ink" : "bg-[#FFF3E7] text-[#9A5B19]"}`}>{row.feedbackOverall === "good" ? "Good" : "Rough"}</span>}
                    </div>
                  </div>
                  {(row.context.length > 0 || row.calmWired !== null) && (
                    <div className="mt-3 space-y-1 border-t border-line pt-3 text-xs leading-relaxed text-muted">
                      <p className="font-medium text-ink">Context flags</p>
                      {row.context.map((item) => <p key={item.reason}>{item.message}</p>)}
                      {row.calmWired !== null && <p>Study tension context: {row.calmWired}/100 calm → wired. This is context only, not a diagnosis.</p>}
                    </div>
                  )}
                </article>
              ))}
            </div>
            {questionQualityFlagged && source === "real" && (
              <Link href="/questions" className="mt-5 inline-flex text-sm font-medium text-brand hover:underline">
                Review questions
              </Link>
            )}
          </section>

          <section className="card p-6">
            <button
              type="button"
              onClick={() => setShowMath((value) => !value)}
              className="flex w-full items-center justify-between text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              aria-expanded={showMath}
            >
              <span className="text-sm font-semibold">How these comparisons work</span>
              <span className="text-muted" aria-hidden="true">{showMath ? "–" : "+"}</span>
            </button>
            {showMath && (
              <div className="mt-4 space-y-3 border-t border-line pt-4 text-sm leading-relaxed text-muted">
                <p><strong className="text-ink">Outcome score:</strong> 50% quiz/self-test, 30% unaided recall, and 20% confidence, combined into a 0–100 score for every session.</p>
                <p><strong className="text-ink">Evidence rule:</strong> fewer than 3 sessions for the leading technique stays “Still gathering evidence.” A result can become emerging at 3+ sessions; “Strongest result so far” needs enough comparable, separated sessions.</p>
                <p>Feedback flags stay attached as context. They never remove a session or automatically declare a technique unsuccessful.</p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="card p-4">
      <p className={`font-semibold tracking-tight text-ink ${small ? "text-base" : "text-2xl"}`}>{value}</p>
      <p className="label mt-1">{label}</p>
    </div>
  );
}

function SubjectPanel({ subject }: { subject: SubjectInsight }) {
  const maxScore = Math.max(...subject.techniques.map((technique) => technique.avgScore), 1);
  return (
    <article className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg font-semibold tracking-tight">{subject.subjectName}</h3>
          <p className="mt-1 text-sm text-muted">
            {subject.totalSessions} completed session{subject.totalSessions === 1 ? "" : "s"} ·{" "}
            {hours(subject.techniques.reduce((total, technique) => total + technique.totalMinutes, 0))} focused
          </p>
        </div>
        <ConfidenceBadge level={subject.confidence} />
      </div>
      <p className="mt-4 text-sm leading-relaxed text-ink">{subject.headline}</p>
      <div className="mt-5 space-y-4">
        {subject.techniques.map((technique) => (
          <div key={technique.technique}>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium text-ink">
                {technique.label}
                {technique.technique === subject.best?.technique && (
                  <span className="ml-2 text-xs text-brand-ink">current leader</span>
                )}
              </span>
              <span className="text-muted">
                {technique.n} session{technique.n === 1 ? "" : "s"} · {technique.avgScore}/100 · {technique.totalMinutes} min
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-line">
              <div
                className={`h-full rounded-full ${technique.technique === subject.best?.technique ? "bg-brand" : "bg-sage"}`}
                style={{ width: `${(technique.avgScore / maxScore) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}