"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJSON } from "@/lib/client";
import { ONBOARDING_QUESTIONS, type Hypothesis } from "@/lib/hypothesis";

type Screen = "questions" | "result";

const WHY_WE_ASK: Record<string, string> = {
  retention: "This helps us understand how well study material stays with you over time.",
  struggle: "This helps us choose a useful first technique to test.",
  check: "This helps us understand how you usually check whether studying worked.",
  consistency: "This gives us context when we compare future study sessions.",
  subject_type: "This helps Calibrate interpret your results more carefully.",
};

function CalibrateMark() {
  return (
    <span aria-hidden="true" className="calibrate-bar-mark">
      <span />
      <span />
      <span />
    </span>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("questions");
  const [questionStep, setQuestionStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<Hypothesis | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const total = ONBOARDING_QUESTIONS.length;
  const question = ONBOARDING_QUESTIONS[questionStep];

  function selectAnswer(optionIndex: number) {
    setAnswers((current) => ({ ...current, [question.id]: optionIndex }));
    setError("");
  }

  async function advanceQuestion() {
    if (answers[question.id] === undefined) return;

    if (questionStep + 1 < total) {
      setQuestionStep((current) => current + 1);
      return;
    }

    setSaving(true);
    try {
      const response = await postJSON<{ hypothesis: Hypothesis }>("/api/onboarding", {
        answers,
      });
      setResult(response.hypothesis);
      setScreen("result");
    } catch {
      setError("We couldn't save your answers. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function retakeOnboarding() {
    setScreen("questions");
    setQuestionStep(0);
    setAnswers({});
    setResult(null);
    setSaving(false);
    setError("");
  }

  function goBack() {
    if (questionStep > 0) {
      setQuestionStep((current) => current - 1);
    } else {
      // First question — return to How It Works
      router.push("/how-it-works");
    }
  }

  return (
    <section className="calibrate-onboarding animate-rise">
      <div className="calibrate-orb calibrate-orb-top" aria-hidden="true" />
      <div className="calibrate-orb calibrate-orb-bottom" aria-hidden="true" />

      <div className="calibrate-content">
        {screen === "questions" && (
          <div className="calibrate-screen calibrate-question-screen">
            <header className="calibrate-question-header">
              <div className="calibrate-question-brand">
                <CalibrateMark />
                <span>Calibrate</span>
              </div>
              <div className="calibrate-progress">
                <div className="calibrate-progress__label">
                  <span>Question {questionStep + 1} of {total}</span>
                  <span aria-hidden="true">{Math.round(((questionStep + 1) / total) * 100)}%</span>
                </div>
                <div
                  className="calibrate-progress__track"
                  role="progressbar"
                  aria-label={`Question ${questionStep + 1} of ${total}`}
                  aria-valuenow={questionStep + 1}
                  aria-valuemin={1}
                  aria-valuemax={total}
                >
                  <span style={{ width: `${((questionStep + 1) / total) * 100}%` }} />
                </div>
              </div>
            </header>
            <div className="calibrate-question-stage" key={question.id}>
              <p className="calibrate-question-kicker">Your study practice</p>
              <h1>
                {question.text}
              </h1>
              <p className="calibrate-question-why">
                <span>Why we ask</span>
                {WHY_WE_ASK[question.id]}
              </p>
            </div>
            <div className="calibrate-answer-group" role="radiogroup" aria-label={question.text}>
              {question.options.map((option, index) => {
                const selected = answers[question.id] === index;
                return (
                  <button
                    key={option.label}
                    type="button"
                    role="radio"
                    onClick={() => selectAnswer(index)}
                    disabled={saving}
                    aria-checked={selected}
                    className={`calibrate-answer ${selected ? "calibrate-answer-selected" : ""}`}
                  >
                    <span className="calibrate-checkbox" aria-hidden="true">{selected ? "✓" : ""}</span>
                    <span>{option.label}</span>
                    {selected && <span className="sr-only">Selected</span>}
                  </button>
                );
              })}
            </div>
            {error && <p className="mt-5 text-center text-sm font-medium text-red-700">{error}</p>}
            <div className="calibrate-question-navigation">
              <button className="calibrate-back static" onClick={goBack}>← Back</button>
              <button
                className="calibrate-button calibrate-button-teal min-w-0 px-6 py-2 disabled:cursor-not-allowed disabled:opacity-45"
                onClick={advanceQuestion}
                disabled={answers[question.id] === undefined || saving}
              >
                {saving ? "Building your hypothesis…" : questionStep + 1 === total ? "See my starting hypothesis" : "Next"}{" "}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        )}

        {screen === "result" && result && (
          <div className="calibrate-screen calibrate-result">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#278783]">Onboarding complete</p>
            <h1 className="calibrate-title mb-5">Your starting hypothesis</h1>
            <p className="mx-auto mb-8 max-w-xl text-center text-base leading-relaxed text-[#3e403a]">
              This is a starting hypothesis based on your answers. It is not a learning-style label. We'll adjust it based on your actual results.
            </p>
            <div className="mx-auto mb-7 w-full max-w-xl rounded-2xl border border-[#c8c8b8] bg-[#fdfcf6]/90 p-6 text-left shadow-sm">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-[#59605a]">Techniques to test first</p>
              <ol className="space-y-3">
                {result.ranked.slice(0, 4).map((technique, index) => (
                  <li key={technique.technique} className="flex items-center gap-3 text-[#20211d]">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-[#d8eee4] text-sm font-semibold text-[#16775a]">{index + 1}</span>
                    <span className="font-medium">{technique.label}</span>
                    {index === 0 && <span className="ml-auto rounded-full bg-[#d8eee4] px-3 py-1 text-xs font-semibold text-[#16775a]">start here</span>}
                  </li>
                ))}
              </ol>
              <p className="mt-5 border-t border-[#d7d7c9] pt-4 text-sm leading-relaxed text-[#555750]">{result.rationale}</p>
            </div>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/study" className="calibrate-button calibrate-button-dark">Start first session</Link>
              <Link href="/dashboard" className="calibrate-button calibrate-button-outline">Go to dashboard</Link>
            </div>
            <button className="calibrate-back" onClick={retakeOnboarding}>Retake onboarding</button>
          </div>
        )}
      </div>
    </section>
  );
}
