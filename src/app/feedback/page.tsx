"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { getJSON, postJSON } from "@/lib/client";

const reasons = [
  { value: "technique_wrong", label: "Technique wasn’t right" },
  { value: "questions_wrong", label: "Questions weren’t right" },
  { value: "material_hard", label: "Material was hard" },
  { value: "distracted_low_energy", label: "Distracted / low energy" },
  { value: "not_sure", label: "Not sure" },
] as const;
type Reason = (typeof reasons)[number]["value"];
type Overall = "rough" | "good";

interface ExistingFeedback { overall: Overall; calmWired: number; reasons: string }
interface FeedbackLoad { session: { id: string; endedAt: string | null }; feedback: ExistingFeedback | null }

export default function FeedbackPage() {
  return <Suspense fallback={<div className="animate-rise mx-auto max-w-xl">Loading your feedback…</div>}><FeedbackContent /></Suspense>;
}

function FeedbackContent() {
  const sessionId = useSearchParams().get("sessionId");
  const router = useRouter();
  const [overall, setOverall] = useState<Overall | null>(null);
  const [calmWired, setCalmWired] = useState(50);
  const [selectedReasons, setSelectedReasons] = useState<Reason[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) { setError("Choose a completed study session before adding feedback."); setLoading(false); return; }
    (async () => {
      try {
        const data = await getJSON<FeedbackLoad>(`/api/session-feedback?sessionId=${encodeURIComponent(sessionId)}`);
        if (data.feedback) {
          setOverall(data.feedback.overall);
          setCalmWired(data.feedback.calmWired);
          try { setSelectedReasons(JSON.parse(data.feedback.reasons) as Reason[]); } catch { setSelectedReasons([]); }
        }
      } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t load this session."); }
      finally { setLoading(false); }
    })();
  }, [sessionId]);

  function toggleReason(reason: Reason) {
    setSelectedReasons((current) => current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason]);
  }
  async function submit() {
    if (!sessionId || !overall || saving) return;
    setSaving(true); setError(null);
    try {
      await postJSON("/api/session-feedback", { sessionId, overall, calmWired, reasons: overall === "rough" ? selectedReasons : [] });
      router.push("/insights");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t save your feedback. Please try again."); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="animate-rise mx-auto max-w-xl">Loading your feedback…</div>;
  if (error && !overall) return <div className="animate-rise mx-auto max-w-lg text-center"><div className="card p-7"><h1 className="text-xl font-semibold">We couldn’t open this feedback.</h1><p className="mt-2 text-sm text-muted">{error}</p><Link className="btn-primary mt-5 inline-block" href="/study">Back to study</Link></div></div>;
  return <main className="animate-rise mx-auto max-w-xl py-4">
    <section className="card graph-paper p-6 sm:p-9">
      <p className="label">Post-session check-in</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">How’d it go?</h1>
      <p className="mt-2 text-sm text-muted">A quick check-in helps Calibrate interpret the result fairly.</p>
      <div className="mt-7 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="How the study session went">
        {(["rough", "good"] as const).map((value) => <button key={value} type="button" role="radio" aria-checked={overall === value} onClick={() => setOverall(value)} className={`rounded-xl border p-6 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${overall === value ? "border-brand bg-brand-soft ring-1 ring-brand" : "border-line bg-surface hover:border-brand/60"}`}><strong className="text-xl">{value === "rough" ? "Rough" : "Good"}</strong><p className="mt-1 text-sm text-muted">{value === "rough" ? "Something got in the way." : "The session felt productive."}</p></button>)}
      </div>
      {overall && <div className="mt-8 border-t border-line pt-6">
        <label className="text-sm font-semibold" htmlFor="calm-wired">Anxiety while studying</label>
        <input id="calm-wired" className="mt-4 w-full accent-brand" type="range" min="0" max="100" step="1" value={calmWired} onChange={(event) => setCalmWired(Number(event.target.value))} aria-valuetext={`${calmWired} out of 100, ${calmWired < 40 ? "closer to calm" : calmWired > 60 ? "closer to wired" : "in the middle"}`} />
        <div className="mt-1 flex justify-between text-xs text-muted"><span>Calm</span><span aria-live="polite">{calmWired}</span><span>Wired</span></div>
      </div>}
      {overall === "rough" && <div className="mt-8 border-t border-line pt-6"><h2 className="text-xl font-semibold">Score dipped today — what happened?</h2><p className="mt-1 text-sm text-muted">Select all that apply. This context doesn’t change your score.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{reasons.map((reason) => { const checked = selectedReasons.includes(reason.value); return <button key={reason.value} type="button" role="checkbox" aria-checked={checked} onClick={() => toggleReason(reason.value)} className={`rounded-lg border p-4 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${checked ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand/60"}`}>{checked && <span aria-hidden="true">✓ </span>}{reason.label}</button>; })}</div></div>}
      {overall && <button className="btn-primary mt-8 w-full py-3" onClick={() => void submit()} disabled={saving}>{saving ? "Saving feedback…" : "Submit"}</button>}
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
    </section>
  </main>;
}