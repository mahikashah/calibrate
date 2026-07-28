"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getJSON, postJSON } from "@/lib/client";
import { outcomeScore } from "@/lib/stats";
import { TECHNIQUES, type TechniqueId } from "@/lib/techniques";
import type { InsightsReport } from "@/lib/recommend";
import type { Hypothesis } from "@/lib/hypothesis";

interface Subject {
  id: string;
  name: string;
  color: string;
}

export default function StudyPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [technique, setTechnique] = useState<TechniqueId>("active_recall");
  const [minutes, setMinutes] = useState(25);
  const [notes, setNotes] = useState("");
  const [quizScore, setQuizScore] = useState(70);
  const [confidence, setConfidence] = useState(3);
  const [recall, setRecall] = useState(60);
  const [saved, setSaved] = useState<null | { score: number }>(null);
  const [saving, setSaving] = useState(false);

  const [report, setReport] = useState<InsightsReport | null>(null);
  const [hypothesis, setHypothesis] = useState<Hypothesis | null>(null);

  // Simple focus timer (counts up; stop to fill "minutes").
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      const [subs, ins, onb] = await Promise.all([
        getJSON<Subject[]>("/api/subjects"),
        getJSON<{ report: InsightsReport }>("/api/insights"),
        getJSON<{ hypothesis?: Hypothesis }>("/api/onboarding"),
      ]);
      setSubjects(subs);
      if (subs[0]) setSubjectId(subs[0].id);
      setReport(ins.report);
      setHypothesis(onb.hypothesis ?? null);
    })();
  }, []);

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running]);

  const recommended = useMemo<{ id: string; label: string; why: string } | null>(() => {
    const subj = report?.subjects.find((s) => s.subjectId === subjectId);
    if (subj?.best && subj.confidence !== "insufficient") {
      return { id: subj.best.technique, label: subj.best.label, why: "your best data so far here" };
    }
    if (hypothesis?.ranked?.[0]) {
      return {
        id: hypothesis.ranked[0].technique,
        label: hypothesis.ranked[0].label,
        why: "your onboarding hypothesis",
      };
    }
    return null;
  }, [report, hypothesis, subjectId]);

  const previewScore = outcomeScore({ quizScore, confidence, recall });

  async function submit() {
    if (!subjectId) return;
    setSaving(true);
    try {
      await postJSON("/api/sessions", {
        subjectId,
        technique,
        plannedMinutes: minutes,
        actualMinutes: minutes,
        notes,
        outcome: { quizScore, confidence, recall, notes: "" },
      });
      setSaved({ score: previewScore });
    } finally {
      setSaving(false);
    }
  }

  if (subjects.length === 0) {
    return (
      <div className="animate-rise mx-auto max-w-lg">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Log a study session</h1>
        <div className="card mt-4 p-6 text-center">
          <p className="mb-1 text-sm font-semibold">Add a subject first</p>
          <p className="mb-4 text-sm text-muted">
            You need at least one subject before you can log a session.
          </p>
          <Link href="/subjects" className="btn-primary">
            Create a subject
          </Link>
        </div>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="animate-rise mx-auto max-w-lg text-center">
        <div className="card graph-paper p-8">
          <p className="label mb-2">Session logged</p>
          <p className="stat text-5xl font-semibold tracking-tight text-clear">{saved.score}</p>
          <p className="mt-1 text-sm text-muted">outcome score / 100</p>
          <p className="mx-auto mt-4 max-w-xs text-sm text-muted">
            One data point recorded. The more sessions you log across techniques, the sharper your
            recommendations get.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => {
                setSaved(null);
                setElapsed(0);
                setNotes("");
              }}
              className="btn-ghost"
            >
              Log another
            </button>
            <Link href="/insights" className="btn-primary">
              See insights
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="animate-rise mx-auto max-w-2xl space-y-6">
      <header>
        <p className="label mb-1">Study session</p>
        <h1 className="text-2xl font-semibold tracking-tight">Run a technique, then check the result</h1>
      </header>

      {/* Subject + recommendation */}
      <div className="card p-5">
        <label className="label mb-2 block">Subject</label>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="field">
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {recommended && (
          <button
            onClick={() => setTechnique(recommended.id as TechniqueId)}
            className="mt-3 flex w-full items-center gap-2 rounded-lg border border-brand/25 bg-brand-soft px-3 py-2 text-left text-sm text-brand-ink"
          >
            <span className="font-mono text-[11px] uppercase tracking-wider">Suggested</span>
            <span className="font-medium">{recommended.label}</span>
            <span className="text-brand-ink/60">— {recommended.why}</span>
          </button>
        )}
      </div>

      {/* Technique picker */}
      <div>
        <p className="label mb-2">Technique</p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {TECHNIQUES.map((t) => {
            const active = t.id === technique;
            return (
              <button
                key={t.id}
                onClick={() => setTechnique(t.id)}
                className={`index-card p-4 text-left ${
                  active ? "ring-2 ring-brand" : ""
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-semibold">{t.label}</span>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      t.kind === "active" ? "bg-clear" : "bg-insufficient"
                    }`}
                    title={t.kind === "active" ? "active retrieval" : "passive control"}
                  />
                </div>
                <p className="text-xs leading-relaxed text-muted">{t.blurb}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Timer + minutes */}
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <div className="stat text-3xl font-semibold tabular-nums">
          {mm}:{ss}
        </div>
        <button
          onClick={() => setRunning((r) => !r)}
          className={running ? "btn-ghost" : "btn-primary"}
        >
          {running ? "Pause" : elapsed ? "Resume" : "Start timer"}
        </button>
        {elapsed > 0 && (
          <button
            onClick={() => {
              setMinutes(Math.max(1, Math.round(elapsed / 60)));
              setRunning(false);
            }}
            className="text-sm text-brand hover:underline"
          >
            Use {Math.max(1, Math.round(elapsed / 60))} min
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <label className="label">Minutes</label>
          <input
            type="number"
            min={1}
            max={240}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="field w-20"
          />
        </div>
      </div>

      {/* Outcome check */}
      <div className="card p-5">
        <p className="label mb-4">Quick outcome check</p>
        <div className="space-y-5">
          <Slider
            label="Quiz / self-test score"
            value={quizScore}
            onChange={setQuizScore}
            suffix="%"
          />
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-ink">Confidence now</span>
              <span className="stat text-sm text-muted">{confidence}/5</span>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setConfidence(n)}
                  className={`h-9 flex-1 rounded-lg border text-sm font-medium transition-colors ${
                    n <= confidence
                      ? "border-brand bg-brand text-white"
                      : "border-line bg-surface text-muted hover:bg-paper"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <Slider
            label="Unaided recall of key ideas"
            value={recall}
            onChange={setRecall}
            suffix="%"
          />
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes — what worked, what didn't…"
          rows={2}
          className="field mt-5 resize-none"
        />

        <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
          <div>
            <p className="label">Computed outcome</p>
            <p className="stat text-2xl font-semibold">{previewScore}</p>
          </div>
          <button onClick={submit} disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Log session"}
          </button>
        </div>
        <p className="mt-3 text-xs text-muted">
          Outcome = 50% quiz + 30% recall + 20% confidence. Same formula for every technique, so the
          comparison is fair.
        </p>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
  suffix = "",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-ink">{label}</span>
        <span className="stat text-sm text-muted">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand"
      />
    </div>
  );
}
