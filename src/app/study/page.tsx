"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { getJSON, postJSON } from "@/lib/client";
import { outcomeScore } from "@/lib/stats";
import { TECHNIQUES, techniqueLabel, type TechniqueId } from "@/lib/techniques";
import { isSimpleAnswerCorrect, isValidMcq, parseAnswerChoices, questionTypeLabel } from "@/lib/study-session";
import type { Hypothesis } from "@/lib/hypothesis";
import type { InsightsReport } from "@/lib/recommend";

interface Subject { id: string; name: string; color: string }
interface Material { id: string; subjectId: string; title: string; content: string }
interface StudyQuestion {
  id: string; subjectId: string; materialId: string | null; type: string; prompt: string;
  answer: string; answerChoices: string | null; sourceExcerpt: string | null; status: string;
}
interface SessionResult { correct: number; attempted: number; elapsed: number; sessionId: string | null }

export default function StudyPage() {
  return <Suspense fallback={<div className="animate-rise mx-auto max-w-2xl">Loading study session…</div>}><StudyPageContent /></Suspense>;
}

function StudyPageContent() {
  const searchParams = useSearchParams();
  const requestedSubject = searchParams.get("subjectId");
  const requestedMaterial = searchParams.get("materialId");
  const isRealContext = Boolean(requestedSubject);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [material, setMaterial] = useState<Material | null>(null);
  const [questions, setQuestions] = useState<StudyQuestion[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [technique, setTechnique] = useState<TechniqueId>("active_recall");
  const [report, setReport] = useState<InsightsReport | null>(null);
  const [hypothesis, setHypothesis] = useState<Hypothesis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [selectedChoice, setSelectedChoice] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [selfAssessment, setSelfAssessment] = useState<boolean | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [completionPending, setCompletionPending] = useState(false);
  const completionKeyRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const [subs, ins, onb] = await Promise.all([
          getJSON<Subject[]>("/api/subjects"),
          getJSON<{ report: InsightsReport }>("/api/insights"),
          getJSON<{ hypothesis?: Hypothesis }>("/api/onboarding"),
        ]);
        if (!live) return;
        setSubjects(subs); setReport(ins.report); setHypothesis(onb.hypothesis ?? null);
        const chosenSubject = requestedSubject && subs.some((s) => s.id === requestedSubject)
          ? requestedSubject : subs[0]?.id ?? "";
        setSubjectId(chosenSubject);
        if (isRealContext) {
          if (!chosenSubject || chosenSubject !== requestedSubject) throw new Error("That study subject is no longer available.");
          const params = new URLSearchParams({ subjectId: chosenSubject, status: "approved" });
          if (requestedMaterial) params.set("materialId", requestedMaterial);
          const approved = await getJSON<StudyQuestion[]>(`/api/questions?${params}`);
          if (!live) return;
          setQuestions(approved);
          if (requestedMaterial) {
            const materials = await getJSON<Material[]>(`/api/materials?subjectId=${encodeURIComponent(chosenSubject)}`);
            if (!live) return;
            setMaterial(materials.find((item) => item.id === requestedMaterial) ?? null);
          }
        }
      } catch (cause) {
        if (live) setError(cause instanceof Error ? cause.message : "We couldn’t load this study session.");
      } finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [isRealContext, requestedMaterial, requestedSubject]);

  useEffect(() => {
    if (running) timerRef.current = setInterval(() => setElapsed((value) => value + 1), 1000);
    else if (timerRef.current) clearInterval(timerRef.current);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running]);

  const recommended = useMemo(() => {
    const insight = report?.subjects.find((item) => item.subjectId === subjectId);
    if (insight?.best && insight.confidence !== "insufficient") return { id: insight.best.technique, label: insight.best.label, why: "your best data so far here" };
    if (hypothesis?.ranked?.[0]) return { id: hypothesis.ranked[0].technique, label: hypothesis.ranked[0].label, why: "your onboarding hypothesis" };
    return null;
  }, [hypothesis, report, subjectId]);
  const subject = subjects.find((item) => item.id === subjectId);
  const current = questions[index];
  const displayTime = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  function begin() { setStarted(true); setRunning(true); }
  function reveal() {
    if (!current) return;
    const response = current.type === "mcq" ? selectedChoice : answer;
    if (!response.trim()) return;
    setRevealed(true); setRunning(false);
    if (current.type === "mcq" || current.type === "fill_in_blank") setSelfAssessment(isSimpleAnswerCorrect(response, current.answer));
  }
  function advance(success: boolean) {
    const nextResults = [...results, success];
    setResults(nextResults); setAnswer(""); setSelectedChoice(""); setRevealed(false); setSelfAssessment(null);
    if (index + 1 < questions.length) { setIndex(index + 1); setRunning(true); }
    else void complete(nextResults);
  }
  async function complete(finalResults: boolean[]) {
    if (completionPending || saving) return;
    setCompletionPending(true);
    setSaving(true);
    setRunning(false);
    completionKeyRef.current ??= `study-${subjectId}-${requestedMaterial ?? "subject"}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const actualMinutes = Math.max(1, Math.round(elapsed / 60));
    const correct = finalResults.filter(Boolean).length;
    const score = finalResults.length ? Math.round((correct / finalResults.length) * 100) : 0;
    try {
      const saved = await postJSON<{ session: { id: string } }>("/api/sessions", {
        subjectId, materialId: requestedMaterial ?? null, technique, plannedMinutes: 25, actualMinutes,
        completionKey: completionKeyRef.current,
        notes: `Approved-question session: ${finalResults.length} reviewed; ${correct} successful.`,
        outcome: { quizScore: score, recall: score, confidence: score >= 80 ? 5 : score >= 60 ? 3 : 2, notes: "" },
      });
      setSessionResult({ correct, attempted: finalResults.length, elapsed, sessionId: saved.session.id });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn’t save this session. Your answers are still here—please try again.");
      setCompletionPending(false);
    } finally { setSaving(false); }
  }

  if (loading) return <div className="animate-rise mx-auto max-w-2xl">Loading your study session…</div>;
  if (error && !started) return <Message title="We couldn’t open this study session." detail={error} />;
  if (!subjects.length) return <Message title="Add a subject first" detail="You need at least one subject before you can start a study session." href="/subjects" action="Create a subject" />;
  if (isRealContext && !questions.length) {
    return <Message title="No approved questions are ready for this session." detail="Review and approve questions in Question Bank before starting this material." href={`/questions?subjectId=${encodeURIComponent(requestedSubject ?? "")}${requestedMaterial ? `&materialId=${encodeURIComponent(requestedMaterial)}` : ""}`} action="Back to Question Bank" />;
  }
  if (!isRealContext) return <PresentationSession subjects={subjects} subjectId={subjectId} setSubjectId={setSubjectId} technique={technique} setTechnique={setTechnique} recommended={recommended} />;
  if (sessionResult) return <Completion result={sessionResult} technique={technique} />;
  if (!started) {
    return <div className="animate-rise mx-auto max-w-2xl space-y-6">
      <header><p className="label mb-1">Study session</p><h1 className="text-3xl font-semibold tracking-tight">Ready to focus?</h1></header>
      <section className="card space-y-4 p-6">
        <div><p className="label">Subject</p><p className="text-xl font-semibold">{subject?.name}</p></div>
        {material && <div><p className="label">Material</p><p className="text-sm text-muted">{material.title}</p></div>}
        <p className="text-sm text-muted">{questions.length} approved question{questions.length === 1 ? "" : "s"} available. You’ll see one at a time.</p>
        {recommended && <button className="w-full rounded-lg border border-brand/25 bg-brand-soft px-3 py-2 text-left text-sm text-brand-ink" onClick={() => setTechnique(recommended.id as TechniqueId)}><strong>Suggested: {recommended.label}</strong> — {recommended.why}</button>}
      </section>
      <TechniquePicker technique={technique} setTechnique={setTechnique} />
      {technique === "rereading" && material ? <section className="card p-6"><p className="label">Re-reading control</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-ink">{material.content}</p><button className="btn-primary mt-5" onClick={begin}>Done reading</button></section> : <button className="btn-primary w-full py-3" onClick={begin}>Start study session</button>}
    </div>;
  }
  if (technique === "rereading") {
    return <div className="animate-rise mx-auto max-w-lg text-center"><div className="card p-7"><p className="label">Re-reading control</p><p className="mt-2 text-sm text-muted">You finished reviewing this material.</p><button className="btn-primary mt-5" disabled={saving || completionPending} onClick={() => void complete([true])}>{saving ? "Saving session…" : "Complete session"}</button>{error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}</div></div>;
  }

  const choices = parseAnswerChoices(current.answerChoices);
  const invalidMcq = current.type === "mcq" && !isValidMcq(current.answer, choices);
  const automatic = current.type === "mcq" || current.type === "fill_in_blank";
  return <main className="animate-rise mx-auto max-w-2xl space-y-5 py-4">
    <header className="flex items-center justify-between gap-3"><div><p className="label">Study session · {techniqueLabel(technique)}</p><p className="text-sm text-muted">Question {index + 1} of {questions.length}</p></div><div className="stat rounded-full border border-line bg-surface px-3 py-1 text-lg">{displayTime}</div></header>
    <div className="h-1 overflow-hidden rounded bg-line" role="progressbar" aria-label="Study progress" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={questions.length}><div className="h-full bg-brand" style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div>
    <section className="card p-6 sm:p-8"><p className="label">{questionTypeLabel(current.type)}</p><h1 className="mt-3 text-2xl font-semibold leading-tight">{current.prompt}</h1>
      {!revealed && current.type === "mcq" && !invalidMcq && <fieldset className="mt-6 space-y-3"><legend className="sr-only">Choose one answer</legend>{choices.map((choice) => <label key={choice} className={`flex cursor-pointer gap-3 rounded-lg border p-4 ${selectedChoice === choice ? "border-brand bg-brand-soft" : "border-line"}`}><input type="radio" name="answer" value={choice} checked={selectedChoice === choice} onChange={() => setSelectedChoice(choice)} />{choice}</label>)}</fieldset>}
      {!revealed && invalidMcq && <div className="mt-6 rounded-lg border border-line bg-paper p-4 text-sm"><p className="font-medium">This question needs review.</p><p className="mt-1 text-muted">Its answer choices are incomplete, so it can’t be graded here.</p><div className="mt-3 flex gap-3"><button className="btn-primary" onClick={() => advance(false)}>Skip question</button><Link className="text-brand hover:underline self-center" href="/questions">Back to Question Bank</Link></div></div>}
      {!revealed && current.type === "feynman" && <><label className="label mt-6 block" htmlFor="study-answer">Explain it in your own words</label><textarea id="study-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} rows={7} className="field resize-y" placeholder="Explain it in your own words…" /></>}
      {!revealed && current.type !== "mcq" && current.type !== "feynman" && <><label className="label mt-6 block" htmlFor="study-answer">Your answer</label><input id="study-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} className="field" /></>}
      {!revealed && !invalidMcq ? <button className="btn-primary mt-6" disabled={current.type === "mcq" ? !selectedChoice : !answer.trim()} onClick={reveal}>Submit and reveal</button> : null}
      {revealed && <Reveal question={current} response={current.type === "mcq" ? selectedChoice : answer} automatic={automatic} assessment={selfAssessment} setAssessment={setSelfAssessment} onNext={advance} saving={saving || completionPending} />}
    </section>
    {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
  </main>;
}

function Reveal({ question, response, automatic, assessment, setAssessment, onNext, saving }: { question: StudyQuestion; response: string; automatic: boolean; assessment: boolean | null; setAssessment: (value: boolean) => void; onNext: (value: boolean) => void; saving: boolean }) {
  const correct = assessment === true;
  return <div className="mt-6 space-y-4 border-t border-line pt-5" aria-live="polite"><p className={`font-semibold ${correct ? "text-clear" : "text-ink"}`}>{automatic ? (correct ? "Correct" : "Not quite") : "Check your response"}</p><div><p className="label">Your answer</p><p className="whitespace-pre-wrap text-sm">{response}</p></div><div className="rounded-lg bg-paper p-4"><p className="label">Suggested answer</p><p className="mt-1 whitespace-pre-wrap text-sm">{question.answer}</p></div>{question.sourceExcerpt && <details><summary className="cursor-pointer text-sm text-brand">View supporting notes</summary><p className="mt-2 whitespace-pre-wrap rounded-lg border border-line p-3 text-sm text-muted">{question.sourceExcerpt}</p></details>}{!automatic && <div><p className="mb-2 text-sm font-medium">How did that feel?</p><div className="flex gap-3"><button className={assessment === true ? "btn-primary" : "btn-ghost"} onClick={() => setAssessment(true)}>{question.type === "feynman" ? "Good" : "Got it"}</button><button className={assessment === false ? "btn-primary" : "btn-ghost"} onClick={() => setAssessment(false)}>{question.type === "feynman" ? "Needs work" : "Missed it"}</button></div></div>}<button className="btn-primary" disabled={assessment === null || saving} onClick={() => assessment !== null && onNext(assessment)}>{saving ? "Saving session…" : "Next question"}</button></div>;
}

function TechniquePicker({ technique, setTechnique }: { technique: TechniqueId; setTechnique: (value: TechniqueId) => void }) {
  return <section><p className="label mb-2">Technique</p><div className="grid gap-2 sm:grid-cols-2">{TECHNIQUES.map((item) => <button key={item.id} onClick={() => setTechnique(item.id)} className={`index-card p-4 text-left ${technique === item.id ? "ring-2 ring-brand" : ""}`}><strong className="text-sm">{item.label}</strong><p className="mt-1 text-xs text-muted">{item.blurb}</p></button>)}</div></section>;
}

function Completion({ result, technique }: { result: SessionResult; technique: TechniqueId }) {
  const minutes = Math.max(1, Math.round(result.elapsed / 60));
  const continueHref = result.sessionId ? `/feedback?sessionId=${encodeURIComponent(result.sessionId)}` : "/study";
  return <div className="animate-rise mx-auto max-w-lg text-center"><div className="card graph-paper p-8"><p className="label">Session complete</p><h1 className="mt-2 text-3xl font-semibold">Nice focused work.</h1><dl className="mt-6 grid grid-cols-2 gap-4 text-left text-sm"><div><dt className="label">Questions reviewed</dt><dd className="stat text-xl">{result.attempted}</dd></div><div><dt className="label">Got it / correct</dt><dd className="stat text-xl">{result.correct}</dd></div><div><dt className="label">Needs work</dt><dd className="stat text-xl">{result.attempted - result.correct}</dd></div><div><dt className="label">Focused time</dt><dd className="stat text-xl">{minutes}m</dd></div></dl><p className="mt-5 text-sm text-muted">Technique: {techniqueLabel(technique)}</p><Link href={continueHref} className="btn-primary mt-6 inline-block">Continue</Link></div></div>;
}

function Message({ title, detail, href = "/questions", action = "Back to Question Bank" }: { title: string; detail: string; href?: string; action?: string }) {
  return <div className="animate-rise mx-auto max-w-lg text-center"><div className="card p-7"><h1 className="text-xl font-semibold">{title}</h1><p className="mt-2 text-sm text-muted">{detail}</p><Link className="btn-primary mt-5 inline-block" href={href}>{action}</Link></div></div>;
}

function PresentationSession({ subjects, subjectId, setSubjectId, technique, setTechnique, recommended }: { subjects: Subject[]; subjectId: string; setSubjectId: (value: string) => void; technique: TechniqueId; setTechnique: (value: TechniqueId) => void; recommended: { id: string; label: string; why: string } | null }) {
  const [saved, setSaved] = useState(false); const [minutes, setMinutes] = useState(25); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  async function save() { if (saving) return; setSaving(true); setError(null); try { await postJSON("/api/sessions", { subjectId, technique, plannedMinutes: minutes, actualMinutes: minutes, notes: "Presentation session", outcome: { quizScore: 70, confidence: 3, recall: 60, notes: "" } }); setSaved(true); } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t save this presentation session. Please try again."); } finally { setSaving(false); } }
  if (saved) return <Completion result={{ correct: 0, attempted: 0, elapsed: minutes * 60, sessionId: null }} technique={technique} />;
  return <div className="animate-rise mx-auto max-w-2xl space-y-6"><header><p className="label">Study session</p><h1 className="text-2xl font-semibold">Run a technique, then check the result</h1></header><section className="card p-5"><label className="label mb-2 block">Subject</label><select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="field">{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{recommended && <button className="mt-3 w-full rounded-lg border border-brand/25 bg-brand-soft px-3 py-2 text-left text-sm text-brand-ink" onClick={() => setTechnique(recommended.id as TechniqueId)}>Suggested: {recommended.label} — {recommended.why}</button>}</section><TechniquePicker technique={technique} setTechnique={setTechnique} /><section className="card p-5"><label className="label">Minutes</label><input type="number" min={1} max={240} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="field mt-2 w-24" /><button className="btn-primary ml-3" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Log presentation session"}</button>{error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}</section></div>;
}