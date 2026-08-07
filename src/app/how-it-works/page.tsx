import Link from "next/link";

const steps = [
  ["01", "Start with a hypothesis", "A few quick questions give you a useful starting point—not a label."],
  ["02", "Run a study experiment", "Try a technique with your real material, then record what happened."],
  ["03", "Follow the evidence", "Calibrate compares your results so you can keep what genuinely helps."],
];

export default function HowItWorksPage() {
  return (
    <section className="calibrate-start calibrate-how-it-works">
      <div className="calibrate-start__orb calibrate-start__orb--top" aria-hidden="true" />
      <div className="calibrate-start__orb calibrate-start__orb--bottom" aria-hidden="true" />

      <div className="calibrate-start__content animate-rise">
        <Link href="/start" className="calibrate-start__back">
          <span aria-hidden="true">←</span> Back to start
        </Link>

        <div className="calibrate-how-it-works__intro">
          <p className="calibrate-start__eyebrow">The Calibrate method</p>
          <h1>Build a study practice that learns with you.</h1>
          <p>
            There is no universal best technique. Calibrate helps you test a few proven approaches
            and use your own results to decide what to do next.
          </p>
        </div>

        <ol className="calibrate-how-it-works__steps">
          {steps.map(([number, title, description]) => (
            <li key={number}>
              <span>{number}</span>
              <div>
                <h2>{title}</h2>
                <p>{description}</p>
              </div>
            </li>
          ))}
        </ol>

        <Link href="/onboarding" className="calibrate-button calibrate-button-dark">
          Start Calibrating <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}