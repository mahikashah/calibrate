"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { getJSON, postJSON } from "@/lib/client";
import { outcomeScore } from "@/lib/stats";
import { TECHNIQUES, techniqueLabel, type TechniqueId } from "@/lib/techniques";
import { techniqueGuidance } from "@/lib/technique-guidance";
import { isSimpleAnswerCorrect, isValidMcq, parseAnswerChoices, questionTypeLabel } from "@/lib/study-session";
import type { Hypothesis } from "@/lib/hypothesis";
import type { InsightsReport } from "@/lib/recommend";

interface Subject { id: string; name: string; color: string }
interface Material { id: string; subjectId: string; title: string; content: string }
interface StudyQuestion {
  id: string; subjectId: string; materialId: string | null; type: string; prompt: string;
  answer: string; answerChoices: string | null; sourceExcerpt: string | null; status: string;
}
interface SessionResult {
  correct: number;
  attempted: number;
  elapsed: number;
  sessionId: string | null;
  quizScore: number;
  recall: number;
  confidence: number;
  subjectName: string;
  materialTitle: string | null;
}

export default function StudyPage() {
  return (
    <Suspense fallback={<div className="animate-rise mx-auto max-w-2xl">Loading study session…</div>}>
      <StudyPageContent />
    </Suspense>
  );
}

function StudyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSubject = searchParams.get("subjectId");
  const requestedMaterial = searchParams.get("materialId");
  const isRealContext = Boolean(requestedSubject);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [material, setMaterial] = useState<Material | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [questions, setQuestions] = useState<StudyQuestion[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [setupMaterialId, setSetupMaterialId] = useState("");
  const [setupApprovedCount, setSetupApprovedCount] = useState<number | null>(null);
  const [technique, setTechnique] = useState<TechniqueId>("active_recall");
  const [report, setReport] = useState<InsightsReport | null>(null);
  const [hypothesis, setHypothesis] = useState<Hypothesis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [readingDone, setReadingDone] = useState(false);
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
      setLoading(true);
      setError(null);
      try {
        const [subs, ins, onb] = await Promise.all([
          getJSON<Subject[]>("/api/subjects"),
          getJSON<{ report: InsightsReport }>("/api/insights"),
          getJSON<{ hypothesis?: Hypothesis }>("/api/onboarding"),
        ]);
        if (!live) return;
        setSubjects(subs);
        setReport(ins.report);
        setHypothesis(onb.hypothesis ?? null);
        const chosenSubject =
          requestedSubject && subs.some((s) => s.id === requestedSubject)
            ? requestedSubject
            : subs[0]?.id ?? "";
        setSubjectId(chosenSubject);

        if (isRealContext) {
          if (!chosenSubject || chosenSubject !== requestedSubject) {
            throw new Error("That study subject is no longer available.");
          }
          const params = new URLSearchParams({ subjectId: chosenSubject, status: "approved" });
          if (requestedMaterial) params.set("materialId", requestedMaterial);
          const approved = await getJSON<StudyQuestion[]>(`/api/questions?${params}`);
          if (!live) return;
          setQuestions(approved);
          const subjectMaterials = await getJSON<Material[]>(
            `/api/materials?subjectId=${encodeURIComponent(chosenSubject)}`,
          );
          if (!live) return;
          setMaterials(subjectMaterials);
          if (requestedMaterial) {
            setMaterial(subjectMaterials.find((item) => item.id === requestedMaterial) ?? null);
          }
        }
      } catch (cause) {
        if (live) setError(cause instanceof Error ? cause.message : "We couldn’t load this study session.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [isRealContext, requestedMaterial, requestedSubject]);

  // Sidebar Study: load approved counts when the student picks a subject/material.
  useEffect(() => {
    if (isRealContext || !subjectId) {
      setSetupApprovedCount(null);
      return;
    }
    let live = true;
    (async () => {
      try {
        const params = new URLSearchParams({ subjectId, status: "approved" });
        if (setupMaterialId) params.set("materialId", setupMaterialId);
        const [approved, subjectMaterials] = await Promise.all([
          getJSON<StudyQuestion[]>(`/api/questions?${params}`),
          getJSON<Material[]>(`/api/materials?subjectId=${encodeURIComponent(subjectId)}`),
        ]);
        if (!live) return;
        setSetupApprovedCount(approved.length);
        setMaterials(subjectMaterials);
        if (setupMaterialId && !subjectMaterials.some((item) => item.id === setupMaterialId)) {
          setSetupMaterialId("");
        }
      } catch {
        if (live) setSetupApprovedCount(0);
      }
    })();
    return () => {
      live = false;
    };
  }, [isRealContext, subjectId, setupMaterialId]);

  useEffect(() => {
    if (running) timerRef.current = setInterval(() => setElapsed((value) => value + 1), 1000);
    else if (timerRef.current) clearInterval(timerRef.current);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running]);

  const recommended = useMemo(() => {
    const insight = report?.subjects.find((item) => item.subjectId === subjectId);
    if (insight?.best && insight.confidence !== "insufficient") {
      return { id: insight.best.technique, label: insight.best.label, why: "your best data so far here" };
    }
    if (hypothesis?.ranked?.[0]) {
      return {
        id: hypothesis.ranked[0].technique,
        label: hypothesis.ranked[0].label,
        why: "your onboarding hypothesis",
      };
    }
    return null;
  }, [hypothesis, report, subjectId]);

  const subject = subjects.find((item) => item.id === subjectId);
  const guidance = techniqueGuidance(technique);
  const current = questions[index];
  const displayTime = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  const needsReadingPhase = technique === "rereading" && Boolean(material) && !readingDone;

  function begin() {
    setStarted(true);
    setRunning(true);
  }

  function reveal() {
    if (!current) return;
    const response = current.type === "mcq" ? selectedChoice : answer;
    if (!response.trim()) return;
    setRevealed(true);
    setRunning(false);
    if (current.type === "mcq" || current.type === "fill_in_blank") {
      setSelfAssessment(isSimpleAnswerCorrect(response, current.answer));
    }
  }

  function advance(success: boolean) {
    const nextResults = [...results, success];
    setResults(nextResults);
    setAnswer("");
    setSelectedChoice("");
    setRevealed(false);
    setSelfAssessment(null);
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setRunning(true);
    } else {
      void complete(nextResults);
    }
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
    const confidence = score >= 80 ? 5 : score >= 60 ? 3 : 2;
    try {
      const saved = await postJSON<{ session: { id: string } }>("/api/sessions", {
        subjectId,
        materialId: requestedMaterial ?? null,
        technique,
        plannedMinutes: 25,
        actualMinutes,
        completionKey: completionKeyRef.current,
        notes: `Approved-question session: ${finalResults.length} reviewed; ${correct} successful.`,
        outcome: { quizScore: score, recall: score, confidence, notes: "" },
      });
      setSessionResult({
        correct,
        attempted: finalResults.length,
        elapsed,
        sessionId: saved.session.id,
        quizScore: score,
        recall: score,
        confidence,
        subjectName: subject?.name ?? "Subject",
        materialTitle: material?.title ?? null,
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "We couldn’t save this session. Your answers are still here—please try again.",
      );
      setCompletionPending(false);
    } finally {
      setSaving(false);
    }
  }

  function startFromSetup() {
    if (!subjectId || !setupApprovedCount) return;
    const params = new URLSearchParams({ subjectId });
    if (setupMaterialId) params.set("materialId", setupMaterialId);
    router.push(`/study?${params}`);
  }

  if (loading) {
    return <div className="animate-rise mx-auto max-w-2xl">Loading your study session…</div>;
  }
  if (error && !started) {
    return <Message title="We couldn’t open this study session." detail={error} />;
  }
  if (!subjects.length) {
    return (
      <Message
        title="Add a subject first"
        detail="You need at least one subject before you can start an outcome-checked study session."
        href="/subjects"
        action="Add a subject"
      />
    );
  }
  if (isRealContext && !questions.length) {
    return (
      <Message
        title="No approved questions yet"
        detail="Generate and approve questions before starting an outcome-checked study session. Only approved questions are eligible."
        href={`/questions?subjectId=${encodeURIComponent(requestedSubject ?? "")}${requestedMaterial ? `&materialId=${encodeURIComponent(requestedMaterial)}` : ""}`}
        action="Review questions"
        secondaryHref={requestedSubject ? `/subjects/${encodeURIComponent(requestedSubject)}/materials/new` : "/subjects"}
        secondaryAction="Add material"
      />
    );
  }

  // Sidebar → Study without Question Bank context.
  if (!isRealContext) {
    return (
      <StudySetup
        subjects={subjects}
        subjectId={subjectId}
        setSubjectId={(id) => {
          setSubjectId(id);
          setSetupMaterialId("");
        }}
        materials={materials}
        setupMaterialId={setupMaterialId}
        setSetupMaterialId={setSetupMaterialId}
        approvedCount={setupApprovedCount}
        technique={technique}
        setTechnique={setTechnique}
        recommended={recommended}
        onStart={startFromSetup}
      />
    );
  }

  if (sessionResult) {
    return <Completion result={sessionResult} technique={technique} />;
  }

  if (!started) {
    return (
      <div className="animate-rise mx-auto max-w-2xl space-y-6">
        <StudyHeader />
        <SessionContextCard
          subjectName={subject?.name ?? "Subject"}
          materialTitle={material?.title ?? null}
          approvedCount={questions.length}
          technique={technique}
          recommended={recommended}
          onUseRecommended={() => recommended && setTechnique(recommended.id as TechniqueId)}
        />
        <TechniquePicker technique={technique} setTechnique={setTechnique} />
        <SessionPreview
          subjectName={subject?.name ?? "Subject"}
          materialTitle={material?.title ?? null}
          approvedCount={questions.length}
          technique={technique}
        />
        {needsReadingPhase ? (
          <section className="card p-6">
            <p className="label">Re-reading</p>
            <p className="mt-2 text-sm text-muted">
              Review the material first. Calibrate will measure the outcome check afterward — not
              reading time alone.
            </p>
            <p className="mt-4 max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-7 text-ink">
              {material?.content}
            </p>
            <button
              type="button"
              className="btn-primary mt-5 min-h-11"
              onClick={() => {
                setReadingDone(true);
                begin();
              }}
            >
              Done reading — start outcome check
            </button>
          </section>
        ) : (
          <button type="button" className="btn-primary w-full min-h-12 py-3" onClick={begin}>
            Start session
          </button>
        )}
      </div>
    );
  }

  const choices = parseAnswerChoices(current.answerChoices);
  const invalidMcq = current.type === "mcq" && !isValidMcq(current.answer, choices);
  const automatic = current.type === "mcq" || current.type === "fill_in_blank";

  return (
    <main className="animate-rise mx-auto max-w-2xl space-y-5 py-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">
            {guidance.label} · outcome check
          </p>
          <p className="mt-1 font-serif text-2xl font-semibold tracking-tight">
            Question {index + 1} of {questions.length}
          </p>
          <p className="mt-1 text-xs text-muted">
            {subject?.name}
            {material ? ` · ${material.title}` : ""}
          </p>
        </div>
        <div
          className="stat rounded-full border border-line bg-surface px-4 py-1.5 text-lg"
          aria-label={`Elapsed time ${displayTime}`}
        >
          {displayTime}
        </div>
      </header>
      <div
        className="h-1.5 overflow-hidden rounded bg-line"
        role="progressbar"
        aria-label="Study progress"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={questions.length}
      >
        <div className="h-full bg-brand" style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
      </div>
      <section className="card p-6 sm:p-8">
        <p className="label">{questionTypeLabel(current.type)}</p>
        <h1 className="mt-3 text-2xl font-semibold leading-tight break-words">{current.prompt}</h1>
        {!revealed && current.type === "mcq" && !invalidMcq && (
          <fieldset className="mt-6 space-y-3">
            <legend className="sr-only">Choose one answer</legend>
            {choices.map((choice) => (
              <label
                key={choice}
                className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border p-4 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand ${
                  selectedChoice === choice ? "border-brand bg-brand-soft" : "border-line"
                }`}
              >
                <input
                  type="radio"
                  name="answer"
                  value={choice}
                  checked={selectedChoice === choice}
                  onChange={() => setSelectedChoice(choice)}
                  className="mt-1"
                />
                <span className="break-words">
                  {choice}
                  {selectedChoice === choice ? " · selected" : ""}
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {!revealed && invalidMcq && (
          <div className="mt-6 rounded-lg border border-line bg-paper p-4 text-sm">
            <p className="font-medium">This question needs review.</p>
            <p className="mt-1 text-muted">Its answer choices are incomplete, so it can’t be graded here.</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" className="btn-primary min-h-11" onClick={() => advance(false)}>
                Skip question
              </button>
              <Link className="self-center text-sm font-medium text-brand hover:underline" href="/questions">
                Review questions
              </Link>
            </div>
          </div>
        )}
        {!revealed && current.type === "feynman" && (
          <>
            <label className="label mt-6 block" htmlFor="study-answer">
              Explain it in your own words
            </label>
            <textarea
              id="study-answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              rows={7}
              className="field mt-2 min-h-40 resize-y"
              placeholder="Explain it in your own words…"
            />
          </>
        )}
        {!revealed && current.type !== "mcq" && current.type !== "feynman" && (
          <>
            <label className="label mt-6 block" htmlFor="study-answer">
              Your answer
            </label>
            <input
              id="study-answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              className="field mt-2 min-h-12"
            />
          </>
        )}
        {!revealed && !invalidMcq ? (
          <button
            type="button"
            className="btn-primary mt-6 min-h-12 w-full sm:w-auto"
            disabled={current.type === "mcq" ? !selectedChoice : !answer.trim()}
            onClick={reveal}
          >
            Submit and reveal
          </button>
        ) : null}
        {revealed && (
          <Reveal
            question={current}
            response={current.type === "mcq" ? selectedChoice : answer}
            automatic={automatic}
            assessment={selfAssessment}
            setAssessment={setSelfAssessment}
            onNext={advance}
            saving={saving || completionPending}
          />
        )}
      </section>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}

function StudyHeader() {
  return (
    <header>
      <p className="label mb-1">Study</p>
      <h1 className="text-3xl font-semibold tracking-tight">Test a study technique</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Try different study techniques on your material. After each session, Calibrate records an
        outcome check and compares your results over time.
      </p>
      <div className="mt-4 rounded-xl border border-line bg-surface px-4 py-3">
        <p className="label">How Calibrate learns what works</p>
        <p className="mt-1 text-sm text-muted">
          Technique → behavior → outcome check → evidence → insight. Duration is context; performance
          is the evidence.
        </p>
      </div>
    </header>
  );
}

function SessionContextCard({
  subjectName,
  materialTitle,
  approvedCount,
  technique,
  recommended,
  onUseRecommended,
}: {
  subjectName: string;
  materialTitle: string | null;
  approvedCount: number;
  technique: TechniqueId;
  recommended: { id: string; label: string; why: string } | null;
  onUseRecommended: () => void;
}) {
  return (
    <section className="card space-y-4 p-6">
      <div>
        <p className="label">Subject</p>
        <p className="font-serif text-xl font-semibold">{subjectName}</p>
      </div>
      {materialTitle && (
        <div>
          <p className="label">Material</p>
          <p className="text-sm text-muted">{materialTitle}</p>
        </div>
      )}
      <p className="text-sm text-muted">
        <strong className="text-ink">{approvedCount}</strong> approved question
        {approvedCount === 1 ? "" : "s"} ready. Only approved questions are used.
      </p>
      <p className="text-sm text-muted">
        Selected technique: <strong className="text-ink">{techniqueLabel(technique)}</strong>
      </p>
      {recommended && (
        <button
          type="button"
          className="w-full rounded-lg border border-brand/25 bg-brand-soft px-3 py-3 text-left text-sm text-brand-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          onClick={onUseRecommended}
        >
          <strong>Suggested: {recommended.label}</strong> — {recommended.why}
        </button>
      )}
    </section>
  );
}

function SessionPreview({
  subjectName,
  materialTitle,
  approvedCount,
  technique,
}: {
  subjectName: string;
  materialTitle: string | null;
  approvedCount: number;
  technique: TechniqueId;
}) {
  const guidance = techniqueGuidance(technique);
  return (
    <section className="card space-y-3 border-brand/20 bg-brand-soft/30 p-6">
      <p className="label">Session preview</p>
      <h2 className="font-serif text-xl font-semibold tracking-tight">{guidance.label}</h2>
      <p className="text-sm text-ink">
        {subjectName}
        {materialTitle ? ` · ${materialTitle}` : ""}
        <span className="text-muted"> · {approvedCount} approved question{approvedCount === 1 ? "" : "s"}</span>
      </p>
      <div>
        <p className="label mb-1">How this session works</p>
        <p className="text-sm text-muted">{guidance.sessionWorks}</p>
      </div>
      <div>
        <p className="label mb-1">What Calibrate measures</p>
        <p className="text-sm text-muted">{guidance.measures}</p>
      </div>
      <p className="text-sm font-medium text-ink">
        Your results will become one evidence point for {guidance.label} in {subjectName}.
      </p>
    </section>
  );
}

function StudySetup({
  subjects,
  subjectId,
  setSubjectId,
  materials,
  setupMaterialId,
  setSetupMaterialId,
  approvedCount,
  technique,
  setTechnique,
  recommended,
  onStart,
}: {
  subjects: Subject[];
  subjectId: string;
  setSubjectId: (value: string) => void;
  materials: Material[];
  setupMaterialId: string;
  setSetupMaterialId: (value: string) => void;
  approvedCount: number | null;
  technique: TechniqueId;
  setTechnique: (value: TechniqueId) => void;
  recommended: { id: string; label: string; why: string } | null;
  onStart: () => void;
}) {
  const subject = subjects.find((item) => item.id === subjectId);
  const materialTitle = materials.find((item) => item.id === setupMaterialId)?.title ?? null;
  const ready = Boolean(subjectId && approvedCount && approvedCount > 0);

  return (
    <div className="animate-rise mx-auto max-w-2xl space-y-6">
      <StudyHeader />
      <section className="card space-y-4 p-6">
        <div>
          <label className="label mb-2 block" htmlFor="study-setup-subject">
            Subject
          </label>
          <select
            id="study-setup-subject"
            className="field"
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
          >
            {subjects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        {materials.length > 0 && (
          <div>
            <label className="label mb-2 block" htmlFor="study-setup-material">
              Material (optional)
            </label>
            <select
              id="study-setup-material"
              className="field"
              value={setupMaterialId}
              onChange={(event) => setSetupMaterialId(event.target.value)}
            >
              <option value="">All approved questions in this subject</option>
              {materials.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>
        )}
        {approvedCount === null ? (
          <p className="text-sm text-muted">Checking approved questions…</p>
        ) : approvedCount === 0 ? (
          <div className="rounded-lg border border-line bg-paper p-4 text-sm">
            <p className="font-semibold text-ink">No approved questions yet</p>
            <p className="mt-1 text-muted">
              Generate and approve questions before starting an outcome-checked study session.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                href={`/questions?subjectId=${encodeURIComponent(subjectId)}`}
                className="btn-primary min-h-11"
              >
                Go to Question Bank
              </Link>
              <Link
                href={`/subjects/${encodeURIComponent(subjectId)}/materials/new`}
                className="btn-ghost min-h-11"
              >
                Add material
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">
            <strong className="text-ink">{approvedCount}</strong> approved question
            {approvedCount === 1 ? "" : "s"} available for this selection.
          </p>
        )}
        {recommended && approvedCount !== null && approvedCount > 0 && (
          <button
            type="button"
            className="w-full rounded-lg border border-brand/25 bg-brand-soft px-3 py-3 text-left text-sm text-brand-ink"
            onClick={() => setTechnique(recommended.id as TechniqueId)}
          >
            <strong>Suggested: {recommended.label}</strong> — {recommended.why}
          </button>
        )}
      </section>
      <TechniquePicker technique={technique} setTechnique={setTechnique} />
      {ready && subject && approvedCount !== null && (
        <SessionPreview
          subjectName={subject.name}
          materialTitle={materialTitle}
          approvedCount={approvedCount}
          technique={technique}
        />
      )}
      <button
        type="button"
        className="btn-primary w-full min-h-12 py-3"
        disabled={!ready}
        onClick={onStart}
      >
        Start session
      </button>
    </div>
  );
}

function TechniquePicker({
  technique,
  setTechnique,
}: {
  technique: TechniqueId;
  setTechnique: (value: TechniqueId) => void;
}) {
  const [expandedId, setExpandedId] = useState<TechniqueId | null>(technique);

  useEffect(() => {
    setExpandedId(technique);
  }, [technique]);

  return (
    <section>
      <p className="label mb-2">Choose a technique to test</p>
      <div className="grid gap-3" role="radiogroup" aria-label="Study technique">
        {TECHNIQUES.map((item) => {
          const guide = techniqueGuidance(item.id);
          const selected = technique === item.id;
          const expanded = expandedId === item.id;
          return (
            <div
              key={item.id}
              className={`rounded-xl border p-4 transition ${
                selected ? "border-brand bg-brand-soft/40 ring-2 ring-brand" : "border-line bg-surface"
              }`}
            >
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTechnique(item.id)}
                className="w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <strong className="text-sm text-ink">
                  {guide.label}
                  {selected ? " · selected" : ""}
                </strong>
                <p className="mt-1 text-xs leading-relaxed text-muted">{guide.shortDescription}</p>
              </button>
              <button
                type="button"
                className="mt-3 text-sm font-medium text-brand underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                aria-expanded={expanded}
                aria-controls={`how-to-${item.id}`}
                onClick={() => setExpandedId((current) => (current === item.id ? null : item.id))}
              >
                {expanded ? "Hide how to do it" : "How to do it"}
              </button>
              {expanded && (
                <div id={`how-to-${item.id}`} className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
                  <ol className="list-decimal space-y-1 pl-5 text-muted">
                    {guide.howTo.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <p className="text-xs text-muted">
                    <strong className="text-ink">Calibrate measures:</strong> {guide.measures}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Reveal({
  question,
  response,
  automatic,
  assessment,
  setAssessment,
  onNext,
  saving,
}: {
  question: StudyQuestion;
  response: string;
  automatic: boolean;
  assessment: boolean | null;
  setAssessment: (value: boolean) => void;
  onNext: (value: boolean) => void;
  saving: boolean;
}) {
  const correct = assessment === true;
  return (
    <div className="mt-6 space-y-4 border-t border-line pt-5" aria-live="polite">
      <p
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${
          automatic
            ? correct
              ? "border-sage/50 bg-sage-soft text-sage-ink"
              : "border-emerging/40 bg-[#FFF3E7] text-[#9A5B19]"
            : "border-line bg-paper text-ink"
        }`}
      >
        {automatic ? (correct ? "Correct" : "Needs Work") : "Check your response"}
      </p>
      <div>
        <p className="label">Your answer</p>
        <p className="whitespace-pre-wrap break-words text-sm">{response}</p>
      </div>
      <div className="rounded-lg bg-paper p-4">
        <p className="label">Suggested answer</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm">{question.answer}</p>
      </div>
      {question.sourceExcerpt && (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-brand">View supporting notes</summary>
          <p className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-line p-3 text-sm text-muted">
            {question.sourceExcerpt}
          </p>
        </details>
      )}
      {!automatic && (
        <div>
          <p className="mb-2 text-sm font-medium">How did that feel?</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={`min-h-11 ${assessment === true ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setAssessment(true)}
            >
              Correct
            </button>
            <button
              type="button"
              className={`min-h-11 ${assessment === false ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setAssessment(false)}
            >
              Needs Work
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        className="btn-primary min-h-12 w-full sm:w-auto"
        disabled={assessment === null || saving}
        onClick={() => assessment !== null && onNext(assessment)}
      >
        {saving ? "Saving session…" : "Next question"}
      </button>
    </div>
  );
}

function Completion({ result, technique }: { result: SessionResult; technique: TechniqueId }) {
  const minutes = Math.max(1, Math.round(result.elapsed / 60));
  const accuracy = result.attempted ? Math.round((result.correct / result.attempted) * 100) : 0;
  const blended = outcomeScore({
    quizScore: result.quizScore,
    confidence: result.confidence,
    recall: result.recall,
  });
  const feedbackHref = result.sessionId
    ? `/feedback?sessionId=${encodeURIComponent(result.sessionId)}`
    : "/insights";
  const guide = techniqueGuidance(technique);

  return (
    <div className="animate-rise mx-auto max-w-lg">
      <div className="card graph-paper p-8 text-center">
        <p className="label">Session complete</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">How did you perform?</h1>
        <p className="mt-2 text-sm text-muted">
          {guide.label} · {result.subjectName}
          {result.materialTitle ? ` · ${result.materialTitle}` : ""}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-4 text-left text-sm">
          <div>
            <dt className="label">Correct</dt>
            <dd className="stat text-xl">
              {result.correct} / {result.attempted}
            </dd>
          </div>
          <div>
            <dt className="label">Accuracy</dt>
            <dd className="stat text-xl">{accuracy}%</dd>
          </div>
          <div>
            <dt className="label">Confidence</dt>
            <dd className="stat text-xl">{result.confidence} / 5</dd>
          </div>
          <div>
            <dt className="label">Outcome score</dt>
            <dd className="stat text-xl">{blended}</dd>
            <p className="mt-1 text-[11px] text-muted">From accuracy, confidence, and recall fields</p>
          </div>
          <div className="col-span-2">
            <dt className="label">Focused time</dt>
            <dd className="stat text-xl">{minutes}m</dd>
            <p className="mt-1 text-[11px] text-muted">Context only — not the ranking signal</p>
          </div>
        </dl>

        <p className="mt-6 rounded-lg border border-line bg-surface px-4 py-3 text-left text-sm text-ink">
          This session is now one evidence point for <strong>{guide.label}</strong> in{" "}
          <strong>{result.subjectName}</strong>.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={feedbackHref} className="btn-primary inline-flex min-h-12 items-center justify-center px-6">
            Continue
          </Link>
          <Link href="/insights" className="btn-ghost inline-flex min-h-12 items-center justify-center px-6">
            View Insights
          </Link>
        </div>
      </div>
    </div>
  );
}

function Message({
  title,
  detail,
  href = "/questions",
  action = "Review questions",
  secondaryHref,
  secondaryAction,
}: {
  title: string;
  detail: string;
  href?: string;
  action?: string;
  secondaryHref?: string;
  secondaryAction?: string;
}) {
  return (
    <div className="animate-rise mx-auto max-w-lg text-center">
      <div className="card p-7">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted">{detail}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link className="btn-primary inline-flex min-h-11 items-center" href={href}>
            {action}
          </Link>
          {secondaryHref && secondaryAction && (
            <Link className="btn-ghost inline-flex min-h-11 items-center" href={secondaryHref}>
              {secondaryAction}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
