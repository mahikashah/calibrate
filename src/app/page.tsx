"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bar, ConfidenceBadge, Empty } from "@/components/ui";
import { getJSON } from "@/lib/client";
import type { InsightsReport } from "@/lib/recommend";
import type { Hypothesis } from "@/lib/hypothesis";

interface Subject {
  id: string;
  name: string;
  color: string;
}
interface OnboardingState {
  completed: boolean;
  hypothesis?: Hypothesis;
}
interface InsightsResponse {
  report: InsightsReport;
  summary: string;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questionCount, setQuestionCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [onb, ins, subs, qs] = await Promise.all([
          getJSON<OnboardingState>("/api/onboarding"),
          getJSON<InsightsResponse>("/api/insights"),
          getJSON<Subject[]>("/api/subjects"),
          getJSON<unknown[]>("/api/questions"),
        ]);
        setOnboarding(onb);
        setInsights(ins);
        setSubjects(subs);
        setQuestionCount(qs.length);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <PageSkeleton />;

  const report = insights?.report;
  const totalSessions = report?.overall.totalSessions ?? 0;
  const hours = Math.round(((report?.overall.totalMinutes ?? 0) / 60) * 10) / 10;
  const hypoTech = onboarding?.hypothesis?.ranked?.[0]?.label;
  const dataVerdict = report?.overall.bestOverallTechnique;

  if (!onboarding?.completed) {
    return (
      <div className="animate-rise mx-auto max-w-xl py-8">
        <section className="graph-paper card overflow-hidden p-7 sm:p-9">
          <p className="label mb-3">First things first</p>
          <h1 className="text-2xl font-semibold tracking-tight">Let’s find your starting point</h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
            Calibrate starts by learning how you study today. A few quick questions create a
            starting hypothesis we’ll test against your real study results.
          </p>
          <Link href="/onboarding" className="btn-primary mt-6">
            Start onboarding →
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="animate-rise space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label mb-1">Dashboard</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Find what actually works for you
          </h1>
        </div>
        <Link href="/study" className="btn-primary">
          Start a study session
        </Link>
      </header>

      {/* Signature: hypothesis vs. evidence */}
      <section className="graph-paper card overflow-hidden">
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto_1fr] md:items-center md:p-8">
          <div>
            <p className="label mb-2">Starting hypothesis</p>
            {onboarding?.completed && hypoTech ? (
              <>
                <p className="text-xl font-semibold tracking-tight">{hypoTech}</p>
                <p className="mt-1 text-sm text-muted">
                  Our first guess from your onboarding — to be tested, not assumed.
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-semibold tracking-tight">Not set yet</p>
                <Link
                  href="/onboarding"
                  className="mt-2 inline-block text-sm font-medium text-brand hover:underline"
                >
                  Take the 2-minute onboarding →
                </Link>
              </>
            )}
          </div>

          <div className="hidden text-muted md:block" aria-hidden>
            <svg width="56" height="24" viewBox="0 0 56 24" fill="none">
              <path
                d="M2 12h48m0 0-8-7m8 7-8 7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="border-t border-line pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0">
            <p className="label mb-2">What your data says</p>
            {dataVerdict ? (
              <>
                <p className="text-xl font-semibold tracking-tight text-clear">{dataVerdict}</p>
                <p className="mt-1 text-sm text-muted">
                  Your highest-scoring technique across all subjects so far.
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-semibold tracking-tight text-muted">
                  Waiting on evidence
                </p>
                <p className="mt-1 text-sm text-muted">
                  Log a few checked sessions and the verdict appears here.
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Sessions logged" value={totalSessions} />
        <StatTile label="Focused time" value={`${hours}h`} />
        <StatTile label="Subjects" value={subjects.length} />
        <StatTile label="Saved questions" value={questionCount} />
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">By subject</h2>
          <Link href="/insights" className="text-sm font-medium text-brand hover:underline">
            Full insights →
          </Link>
        </div>

        {report && report.subjects.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {report.subjects.slice(0, 4).map((s) => (
              <div key={s.subjectId} className="card p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-semibold tracking-tight">{s.subjectName}</h3>
                  <ConfidenceBadge level={s.confidence} />
                </div>
                <p className="mb-4 text-sm text-muted">{s.headline}</p>
                <div className="space-y-2.5">
                  {s.techniques.slice(0, 3).map((t) => (
                    <div key={t.technique}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-ink">{t.label}</span>
                        <span className="stat text-muted">
                          {t.avgScore}
                          <span className="text-muted/50"> · n={t.n}</span>
                        </span>
                      </div>
                      <Bar
                        value={t.avgScore}
                        color={t.technique === s.best?.technique ? "#208B8B" : "#B9CCB5"}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <GetStarted hasSubjects={subjects.length > 0} />
        )}
      </section>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <p className="stat text-2xl font-semibold tracking-tight">{value}</p>
      <p className="label mt-1">{label}</p>
    </div>
  );
}

function GetStarted({ hasSubjects }: { hasSubjects: boolean }) {
  const steps = [
    { n: "01", label: "Take the onboarding", href: "/onboarding", done: false },
    { n: "02", label: hasSubjects ? "Add material & questions" : "Create a subject", href: hasSubjects ? "/questions" : "/subjects" },
    { n: "03", label: "Log your first session", href: "/study" },
  ];
  return (
    <div className="card p-6">
      <p className="mb-1 text-sm font-semibold">Get started in three steps</p>
      <p className="mb-5 text-sm text-muted">
        StudyCoach needs a little of your real study data before it can recommend anything.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {steps.map((s) => (
          <Link
            key={s.n}
            href={s.href}
            className="index-card flex items-center gap-3 p-4"
          >
            <span className="font-mono text-sm text-brand">{s.n}</span>
            <span className="text-sm font-medium">{s.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-8">
      <div className="h-8 w-64 animate-pulse rounded bg-line" />
      <div className="h-40 animate-pulse rounded-xl bg-line" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-line" />
        ))}
      </div>
    </div>
  );
}
