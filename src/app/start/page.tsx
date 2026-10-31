import Link from "next/link";
import { Fragment } from "react";
import { ChevronRight } from "@/components/icons";
import { StartMascot } from "@/components/StartMascot";

function CalibrateMark() {
  return (
    <span aria-hidden="true" className="calibrate-bar-mark">
      <span />
      <span />
      <span />
    </span>
  );
}

const HEADLINE = ["Stop", "guessing", "how", "to", "study."];

export default function StartPage() {
  return (
    <section className="calibrate-start calibrate-start--intro">
      <div className="calibrate-start__orb calibrate-start__orb--top" aria-hidden="true" />
      <div className="calibrate-start__orb calibrate-start__orb--bottom" aria-hidden="true" />
      <div className="calibrate-start__glow" aria-hidden="true" />
      <div className="calibrate-start__grid" aria-hidden="true" />

      <div className="calibrate-start__content">
        <div className="calibrate-start__hero">
          <header className="calibrate-start__brand calibrate-start__brand--centered intro-step" style={{ ["--d" as string]: "0ms" }}>
            <CalibrateMark />
            <span>Calibrate</span>
          </header>
          <p className="calibrate-start__eyebrow intro-eyebrow">Study with evidence</p>
          <h1 aria-label={HEADLINE.join(" ")}>
            {HEADLINE.map((word, i) => (
              <Fragment key={word}>
                <span aria-hidden="true" className="intro-word-wrap">
                  <span
                    className={`intro-word${i === HEADLINE.length - 1 ? " intro-word--accent" : ""}`}
                    style={{ ["--i" as string]: i }}
                  >
                    {word}
                    {i === HEADLINE.length - 1 && (
                      <svg className="intro-underline" viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true">
                        <path d="M4 17 C 70 6, 150 4, 296 12" />
                      </svg>
                    )}
                  </span>
                </span>
                {i < HEADLINE.length - 1 && " "}
              </Fragment>
            ))}
          </h1>
          <p className="calibrate-start__lede intro-step" style={{ ["--d" as string]: "900ms" }}>
            Test evidence-based techniques, track what happens, and learn what actually works for you.
          </p>

          <div className="calibrate-start__actions intro-step" style={{ ["--d" as string]: "1050ms" }}>
            <Link href="/how-it-works" className="calibrate-button calibrate-button-dark intro-cta">
              Start Calibrating <ChevronRight className="nudge" />
            </Link>
            <StartMascot />
          </div>
        </div>

        <Link href="/dashboard" className="calibrate-start__return intro-step" style={{ ["--d" as string]: "1250ms" }}>
          View Dashboard <ChevronRight className="nudge" />
        </Link>
      </div>
    </section>
  );
}
