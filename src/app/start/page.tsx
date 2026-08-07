import Link from "next/link";

function CalibrateMark() {
  return (
    <span aria-hidden="true" className="calibrate-bar-mark">
      <span />
      <span />
      <span />
    </span>
  );
}

export default function StartPage() {
  return (
    <section className="calibrate-start">
      <div className="calibrate-start__orb calibrate-start__orb--top" aria-hidden="true" />
      <div className="calibrate-start__orb calibrate-start__orb--bottom" aria-hidden="true" />
      <div className="calibrate-start__grid" aria-hidden="true" />

      <div className="calibrate-start__content animate-rise">
        <header className="calibrate-start__brand">
          <CalibrateMark />
          <span>Calibrate</span>
        </header>

        <div className="calibrate-start__hero">
          <p className="calibrate-start__eyebrow">Study with evidence</p>
          <h1>Stop guessing how to study.</h1>
          <p className="calibrate-start__lede">
            Test evidence-based techniques, track what happens, and learn what actually works for you.
          </p>

          <div className="calibrate-start__actions">
            <Link href="/onboarding" className="calibrate-button calibrate-button-dark">
              Start Calibrating <span aria-hidden="true">→</span>
            </Link>
            <Link href="/how-it-works" className="calibrate-button calibrate-button-outline">
              How It Works
            </Link>
          </div>
        </div>

        <Link href="/" className="calibrate-start__return">
          Continue to dashboard <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}