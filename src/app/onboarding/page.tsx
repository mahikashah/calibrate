"use client";

import Link from "next/link";
import { useState } from "react";
import { postJSON } from "@/lib/client";
import { ONBOARDING_QUESTIONS, type Hypothesis } from "@/lib/hypothesis";

type Screen = "welcome" | "intro" | "how-it-works" | "ready" | "questions" | "result";

const INTRO_DOTS: Record<"intro" | "how-it-works" | "ready", number> = {
  intro: 0,
  "how-it-works": 1,
  ready: 2,
};

function CalibrateMark() {
  return (
    <span aria-hidden="true" className="flex items-end gap-1">
      <span className="h-7 w-3.5 rounded-sm bg-[#51c39d]" />
      <span className="h-11 w-3.5 rounded-sm bg-[#078a70]" />
      <span className="h-8 w-3.5 rounded-sm bg-[#1ca77f]" />
    </span>
  );
}

function ProgressDots({ active }: { active: number }) {
  return (
    <div className="mb-12 flex justify-center gap-3" aria-label={`Step ${active + 1} of 3`}>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={`h-4 w-4 rounded-full ${
            index <= active ? "bg-[#42a4aa]" : "bg-[#11110f]"
          }`}
        />
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [questionStep, setQuestionStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<Hypothesis | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const total = ONBOARDING_QUESTIONS.length;
  const question = ONBOARDING_QUESTIONS[questionStep];

  async function selectAnswer(optionIndex: number) {
    const next = { ...answers, [question.id]: optionIndex };
    setAnswers(next);
    setError("");

    if (questionStep + 1 < total) {
      setQuestionStep((current) => current + 1);
      return;
    }

    setSaving(true);
    try {
      const response = await postJSON<{ hypothesis: Hypothesis }>("/api/onboarding", {
        answers: next,
      });
      setResult(response.hypothesis);
      setScreen("result");
    } catch {
      setError("We couldn’t save your answers. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function goBack() {
    if (screen === "questions" && questionStep > 0) {
      setQuestionStep((current) => current - 1);
      return;
    }
    if (screen === "questions") setScreen("ready");
    if (screen === "intro") setScreen("welcome");
    if (screen === "how-it-works") setScreen("intro");
    if (screen === "ready") setScreen("how-it-works");
  }

  const introScreen = screen === "intro" || screen === "how-it-works" || screen === "ready";
  const introDot = introScreen ? INTRO_DOTS[screen] : null;

  return (
    <section className="calibrate-onboarding animate-rise">
      <div className="calibrate-orb calibrate-orb-top" aria-hidden="true" />
      <div className="calibrate-orb calibrate-orb-bottom" aria-hidden="true" />

      <div className="calibrate-content">
        {screen === "welcome" && (
          <div className="calibrate-screen">
            <div className="mb-8 flex items-center justify-center gap-5">
              <CalibrateMark />
              <span className="font-serif text-5xl leading-none tracking-tight text-[#25251f] sm:text-6xl">
                Calibrate
              </span>
            </div>
            <p className="mb-10 text-center text-xl font-semibold text-[#454641] sm:text-2xl">
              Here for all your study needs.
            </p>
            <div className="flex w-full flex-col justify-center gap-3 sm:flex-row">
              <button className="calibrate-button calibrate-button-dark" onClick={() => setScreen("intro")}>
                Get Started <span aria-hidden="true">→</span>
              </button>
              <button className="calibrate-button calibrate-button-outline" onClick={() => setScreen("intro")}>
                See how it works
              </button>
            </div>
            <p className="mt-10 text-center text-sm text-[#23231f]">
              Already have an account? <Link className="font-semibold underline underline-offset-2" href="/">Log in</Link>
            </p>
          </div>
        )}

        {introScreen && introDot !== null && (
          <div className="calibrate-screen">
            <ProgressDots active={introDot} />
            {screen === "intro" && (
              <>
                <h1 className="calibrate-heading">
                  Calibrate is a dedicated AI study coach to help you figure out what study method works best for you.
                </h1>
                <p className="calibrate-lede">We test, measure, and adapt.</p>
                <button className="calibrate-button calibrate-button-teal" onClick={() => setScreen("how-it-works")}>
                  Next <span aria-hidden="true">→</span>
                </button>
              </>
            )}
            {screen === "how-it-works" && (
              <>
                <h1 className="calibrate-title">How it Works</h1>
                <ol className="mx-auto mb-12 max-w-md list-decimal space-y-1 pl-8 text-left text-xl leading-tight text-[#171814] sm:text-2xl">
                  <li>Paste your notes</li>
                  <li>Study with the assigned technique</li>
                  <li>We measure what actually helps</li>
                </ol>
                <button className="calibrate-button calibrate-button-teal" onClick={() => setScreen("ready")}>
                  Next <span aria-hidden="true">→</span>
                </button>
              </>
            )}
            {screen === "ready" && (
              <>
                <h1 className="calibrate-heading">
                  First, a couple of quick questions. How you study, what’s worked before, what hasn’t.
                </h1>
                <p className="calibrate-lede">Takes under a minute.</p>
                <button className="calibrate-button calibrate-button-teal" onClick={() => setScreen("questions")}>
                  Start <span aria-hidden="true">→</span>
                </button>
              </>
            )}
            <button className="calibrate-back" onClick={goBack}>← Back</button>
          </div>
        )}

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
              <span className="text-sm text-[#575851]">{questionStep + 1} of {total}</span>
            </div>
          </div>
        )}

        {screen === "result" && result && (
          <div className="calibrate-screen calibrate-result">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#278783]">Onboarding complete</p>
            <h1 className="calibrate-title mb-5">Your starting hypothesis</h1>
            <p className="mx-auto mb-8 max-w-xl text-center text-base leading-relaxed text-[#3e403a]">
              This is a starting hypothesis based on your answers. It is not a learning-style label. We’ll adjust it based on your actual results.
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
              <Link href="/study" className="calibrate-button calibrate-button-dark">Log your first session</Link>
              <Link href="/" className="calibrate-button calibrate-button-outline">Back to dashboard</Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}