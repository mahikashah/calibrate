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
            <p className="calibrate-result__eyebrow">Onboarding complete</p>
            <h1 className="calibrate-title calibrate-result__title">Your starting hypothesis</h1>
            <p className="calibrate-result__intro">
              This is a starting hypothesis based on your answers. It is not a learning-style label. We'll adjust it based on your actual results.
            </p>
            <div className="calibrate-result__card">
              <p className="calibrate-result__card-label">Techniques to test first</p>
              <ol className="calibrate-result__ranking">
                {result.ranked.slice(0, 4).map((technique, index) => (
                  <li key={technique.technique}>
                    <span className="calibrate-result__rank">{index + 1}</span>
                    <span className="calibrate-result__technique">{technique.label}</span>
                    {index === 0 && <span className="calibrate-result__start-here">Start here</span>}
                  </li>
                ))}
              </ol>
              <p className="calibrate-result__rationale">{result.rationale}</p>
            </div>
            <p className="calibrate-result__next-step">
              <span>Next step</span>
              Set up a subject so you can add your real class material before your first study experiment.
            </p>
            <div className="calibrate-result__actions">
              <Link href="/subjects" className="calibrate-button calibrate-button-teal">
                Set up my first subject <span aria-hidden="true">→</span>
              </Link>
              <Link href="/dashboard" className="calibrate-button calibrate-button-outline">View Dashboard</Link>
            </div>
            <button className="calibrate-back" onClick={retakeOnboarding}>Retake onboarding</button>
          </div>
        )}
      </div>
    </section>
  );
}
