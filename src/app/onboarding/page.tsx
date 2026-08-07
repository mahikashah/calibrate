"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJSON } from "@/lib/client";
import { ONBOARDING_QUESTIONS, type Hypothesis } from "@/lib/hypothesis";

type Screen = "questions" | "result";

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
            <div className="mb-12 flex justify-center gap-3" aria-label={`Question ${questionStep + 1} of ${total}`}>
              {Array.from({ length: total }, (_, index) => (
                <span key={index} className={`h-3.5 w-3.5 rounded-full ${index <= questionStep ? "bg-[#42a4aa]" : "bg-[#171814]"}`} />
              ))}
            </div>
            <h1 className="mx-auto mb-3 max-w-2xl text-center text-2xl font-medium leading-tight text-[#171814] sm:text-4xl">
              {question.text}
            </h1>
            <p className="mb-7 text-center text-sm text-[#454641]">Select one answer</p>
            <div className="mx-auto w-full max-w-2xl space-y-4">
              {question.options.map((option, index) => {
                const selected = answers[question.id] === index;
                return (
                  <button
                    key={option.label}
                    onClick={() => selectAnswer(index)}
                    disabled={saving}
                    aria-pressed={selected}
                    className={`calibrate-answer ${selected ? "calibrate-answer-selected" : ""}`}
                  >
                    <span className="calibrate-checkbox">{selected ? "✓" : ""}</span>
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
            {error && <p className="mt-5 text-center text-sm font-medium text-red-700">{error}</p>}
            <div className="mt-7 flex items-center justify-between">
              <button className="calibrate-back static" onClick={goBack}>← Back</button>
              <div className="flex items-center gap-4">
                <span className="text-sm text-[#575851]">{questionStep + 1} of {total}</span>
                <button
                  className="calibrate-button calibrate-button-teal min-w-0 px-6 py-2 disabled:cursor-not-allowed disabled:opacity-45"
                  onClick={advanceQuestion}
                  disabled={answers[question.id] === undefined || saving}
                >
                  {saving ? "Saving…" : questionStep + 1 === total ? "Finish" : "Next"}{" "}
                  <span aria-hidden="true">→</span>
                </button>
              </div>
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
