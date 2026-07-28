"use client";

import Link from "next/link";
import { useState } from "react";
import { postJSON } from "@/lib/client";
import { ONBOARDING_QUESTIONS, type Hypothesis } from "@/lib/hypothesis";

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<Hypothesis | null>(null);
  const [saving, setSaving] = useState(false);

  const total = ONBOARDING_QUESTIONS.length;
  const q = ONBOARDING_QUESTIONS[step];

  async function choose(optionIndex: number) {
    const next = { ...answers, [q.id]: optionIndex };
    setAnswers(next);
    if (step + 1 < total) {
      setStep(step + 1);
    } else {
      setSaving(true);
      try {
        const res = await postJSON<{ hypothesis: Hypothesis }>("/api/onboarding", {
          answers: next,
        });
        setResult(res.hypothesis);
      } finally {
        setSaving(false);
      }
    }
  }

  if (result) {
    return (
      <div className="animate-rise mx-auto max-w-xl">
        <p className="label mb-1">Onboarding complete</p>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Your starting hypothesis</h1>
        <p className="mb-6 text-sm text-muted">
          A first guess about where to start — StudyCoach will confirm or overturn it with your real
          session data.
        </p>

        <div className="graph-paper card mb-6 p-6">
          <p className="label mb-3">Techniques to test first</p>
          <ol className="space-y-2">
            {result.ranked.slice(0, 4).map((t, i) => (
              <li key={t.technique} className="flex items-center gap-3">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-brand-soft font-mono text-xs text-brand-ink">
                  {i + 1}
                </span>
                <span className="text-sm font-medium">{t.label}</span>
                {i === 0 && (
                  <span className="chip ml-auto border-brand/30 bg-brand-soft text-brand-ink">
                    start here
                  </span>
                )}
              </li>
            ))}
          </ol>
          <p className="mt-4 border-t border-line pt-4 text-sm leading-relaxed text-muted">
            {result.rationale}
          </p>
        </div>

        <div className="flex gap-3">
          <Link href="/study" className="btn-primary">
            Log your first session
          </Link>
          <Link href="/" className="btn-ghost">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-rise mx-auto max-w-xl">
      <p className="label mb-1">Onboarding · {step + 1} of {total}</p>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">A few quick questions</h1>

      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300"
          style={{ width: `${(step / total) * 100}%` }}
        />
      </div>

      <div className="card p-6">
        <p className="mb-5 text-lg font-medium tracking-tight">{q.text}</p>
        <div className="space-y-2.5">
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => choose(i)}
              disabled={saving}
              className="index-card flex w-full items-center gap-3 p-4 text-left disabled:opacity-60"
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-line font-mono text-xs text-muted">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="text-sm">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {step > 0 && (
        <button onClick={() => setStep(step - 1)} className="mt-4 text-sm text-muted hover:text-ink">
          ← Back
        </button>
      )}

      <p className="mt-6 text-xs leading-relaxed text-muted">
        These questions ask how you actually study and where you struggle — not to label you as a
        “type.” The learning-styles idea has no experimental support; StudyCoach tests techniques
        instead.
      </p>
    </div>
  );
}
