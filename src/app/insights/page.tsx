"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ErrorBar,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AiTag, ConfidenceBadge, Empty } from "@/components/ui";
import { getJSON } from "@/lib/client";
import type { InsightsReport, SubjectInsight } from "@/lib/recommend";

interface InsightsResponse {
  report: InsightsReport;
  summary: string;
  summaryProvider: string;
  fellBack: boolean;
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMath, setShowMath] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setData(await getJSON<InsightsResponse>("/api/insights"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-line" />;

  const report = data?.report;
  const hasData = report && report.subjects.length > 0;

  return (
    <div className="animate-rise space-y-8">
      <header>
        <p className="label mb-1">Insights</p>
        <h1 className="text-2xl font-semibold tracking-tight">What the evidence shows</h1>
      </header>

      {!hasData ? (
        <Empty title="No insights yet">
          Log a few study sessions with outcome checks and this page will show which techniques are
          working best for each subject.{" "}
          <Link href="/study" className="font-medium text-brand hover:underline">
            Log a session →
          </Link>
        </Empty>
      ) : (
        <>
          {/* AI-phrased summary of the computed numbers */}
          <section className="card p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold tracking-tight">Summary</h2>
              <AiTag provider={data?.summaryProvider} />
            </div>
            <p className="text-sm leading-relaxed text-ink">{data?.summary}</p>
            <p className="mt-3 text-xs text-muted">
              The numbers below are computed directly from your data. AI only phrases this summary —
              it never decides which technique wins.
            </p>
          </section>

          {/* Overall roll-up */}
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="Checked sessions" value={report.overall.totalSessions} />
            <Tile
              label="Focused time"
              value={`${Math.round((report.overall.totalMinutes / 60) * 10) / 10}h`}
            />
            <Tile label="Most practiced" value={report.overall.mostUsedTechnique ?? "—"} small />
            <Tile label="Best overall" value={report.overall.bestOverallTechnique ?? "—"} small />
          </section>

          {/* Per-subject comparisons */}
          <section className="space-y-4">
            {report.subjects.map((s) => (
              <SubjectPanel key={s.subjectId} subject={s} />
            ))}
          </section>

          {/* Transparency panel */}
          <section className="card p-6">
            <button
              onClick={() => setShowMath((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="text-sm font-semibold">How these recommendations are computed</span>
              <span className="text-muted">{showMath ? "–" : "+"}</span>
            </button>
            {showMath && (
              <div className="mt-4 space-y-3 border-t border-line pt-4 text-sm leading-relaxed text-muted">
                <p>
                  <span className="font-medium text-ink">Outcome score.</span> Each checked session
                  gets a 0–100 score: 50% quiz/self-test, 30% unaided recall, 20% confidence. The
                  same formula applies to every technique, so comparisons are fair.
                </p>
                <p>
                  <span className="font-medium text-ink">Per technique.</span> We average the outcome
                  scores for each technique within a subject and attach a 95% confidence interval
                  (wider when you have fewer sessions).
                </p>
                <p>
                  <span className="font-medium text-ink">Confidence level.</span> “Clear signal” means
                  the leader has at least 4 sessions and beats the runner-up by more than their
                  intervals overlap. Otherwise it stays “emerging” until more data comes in.
                </p>
                <p className="text-xs">
                  No machine-learning model is involved in these recommendations — it is all in{" "}
                  <code className="rounded bg-paper px-1 py-0.5 font-mono">src/lib/recommend.ts</code>.
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  small,
}: {
  label: string;
  value: string | number;
  small?: boolean;
}) {
  return (
    <div className="card p-4">
      <p className={`stat font-semibold tracking-tight ${small ? "text-base" : "text-2xl"}`}>
        {value}
      </p>
      <p className="label mt-1">{label}</p>
    </div>
  );
}

function SubjectPanel({ subject }: { subject: SubjectInsight }) {
  const chartData = subject.techniques.map((t) => ({
    name: t.label.replace(" (control)", ""),
    score: t.avgScore,
    ci: t.ci,
    n: t.n,
    best: t.technique === subject.best?.technique,
  }));

  return (
    <div className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{subject.subjectName}</h3>
          <p className="stat text-xs text-muted">
            {subject.totalSessions} checked session{subject.totalSessions === 1 ? "" : "s"}
          </p>
        </div>
        <ConfidenceBadge level={subject.confidence} />
      </div>

      <p className="mb-5 text-sm leading-relaxed text-ink">{subject.headline}</p>

      <div style={{ height: Math.max(120, chartData.length * 46) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 44, bottom: 4, left: 8 }}
            barCategoryGap={10}
          >
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              type="category"
              dataKey="name"
              width={128}
              tick={{ fontSize: 12, fill: "#15171C" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(21,23,28,0.03)" }}
              formatter={(v: number, _n, p) => [`${v}/100 (n=${p.payload.n})`, "avg score"]}
              contentStyle={{
                border: "1px solid #E4E7EC",
                borderRadius: 10,
                fontSize: 12,
                boxShadow: "0 8px 24px rgba(21,23,28,0.10)",
              }}
            />
            <Bar dataKey="score" radius={[0, 6, 6, 0]} isAnimationActive={false}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.best ? "#0E7C66" : "#C4C9D4"} />
              ))}
              <ErrorBar dataKey="ci" width={4} strokeWidth={1.5} stroke="#697086" direction="x" />
              <LabelList
                dataKey="score"
                position="right"
                formatter={(v: number) => `${v}`}
                style={{ fontSize: 11, fill: "#697086", fontFamily: "ui-monospace" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-xs text-muted">
        Bars show the average outcome score per technique; whiskers are 95% confidence intervals.
        Green marks the current leader.
      </p>
    </div>
  );
}
