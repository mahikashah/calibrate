import Image from "next/image";
import Link from "next/link";

type Step = {
  number: string;
  title: string;
  explanation: string;
  why: string;
  previews: Array<{
    src: string;
    alt: string;
  }>;
};

const STEPS: Step[] = [
  {
    number: "01",
    title: "Answer a few quick questions",
    explanation: "Tell us a little about how you currently study.",
    why: "This helps Calibrate choose a useful first technique to test.",
    previews: [
      {
        src: "/how-it-works/step1.png",
        alt: "Calibrate onboarding question with the Active Recall answer selected",
      },
    ],
  },
  {
    number: "02",
    title: "Get your starting hypothesis",
    explanation: "Calibrate suggests a study technique to begin testing based on your onboarding answers.",
    why: "It’s only a starting hypothesis — your real study results can confirm or change it.",
    previews: [
      {
        src: "/how-it-works/step2.png",
        alt: "Calibrate Starting Hypothesis screen ranking study techniques",
      },
    ],
  },
  {
    number: "03",
    title: "Bring your real class material",
    explanation: "Upload a PDF or paste the notes you’re actually studying.",
    why: "Your practice questions are created from your own course material.",
    previews: [
      {
        src: "/how-it-works/step3.png",
        alt: "Calibrate material screen for pasting notes or uploading a file",
      },
    ],
  },
  {
    number: "04",
    title: "Review your questions, then study",
    explanation: "Review the AI-generated practice, then run a focused session using the technique you’re testing.",
    why: "You stay in control of the questions before they affect your study experiment.",
    previews: [
      {
        src: "/how-it-works/step4_1.png",
        alt: "Calibrate Question Bank showing generated, approved, and needs-edit questions",
      },
      {
        src: "/how-it-works/step4_2.png",
        alt: "Calibrate Study Session screen showing available study techniques",
      },
    ],
  },
  {
    number: "05",
    title: "See what actually worked",
    explanation: "After enough study sessions, Calibrate compares your results across techniques.",
    why: "Your actual session data — not a learning-style label — helps decide what is worth using again.",
    previews: [
      {
        src: "/how-it-works/step5.png",
        alt: "Calibrate Insights screen summarizing study-session evidence",
      },
    ],
  },
];

function CalibrateMark() {
  return (
    <span aria-hidden="true" className="calibrate-bar-mark">
      <span />
      <span />
      <span />
    </span>
  );
}

function ProductPreview({ preview, paired }: { preview: Step["previews"][number]; paired: boolean }) {
  return (
    <figure className={`calibrate-tour__preview ${paired ? "calibrate-tour__preview--paired" : ""}`}>
      <Image
        src={preview.src}
        alt={preview.alt}
        width={1600}
        height={1200}
        sizes={paired ? "(max-width: 720px) 100vw, 40vw" : "(max-width: 720px) 100vw, 54vw"}
      />
    </figure>
  );
}

export default function HowItWorksPage() {
  return (
    <section className="calibrate-start calibrate-tour">
      <div className="calibrate-start__orb calibrate-start__orb--top" aria-hidden="true" />
      <div className="calibrate-start__orb calibrate-start__orb--bottom" aria-hidden="true" />
      <div className="calibrate-start__grid" aria-hidden="true" />

      <div className="calibrate-tour__shell">
        <header className="calibrate-tour__header animate-rise">
          <Link href="/start" className="calibrate-start__brand" aria-label="Back to Calibrate start">
            <CalibrateMark />
            <span>Calibrate</span>
          </Link>
          <Link href="/start" className="calibrate-start__back">
            <span aria-hidden="true">←</span> Back
          </Link>
        </header>

        <div className="calibrate-tour__intro animate-rise">
          <p className="calibrate-start__eyebrow">Your first experiment</p>
          <h1>How Calibrate works</h1>
          <p>Run small study experiments and learn what actually works for you.</p>
          <span>Here’s what your first experiment will look like.</span>
        </div>

        <ol className="calibrate-tour__steps">
          {STEPS.map((step, index) => {
            const paired = step.previews.length === 2;
            return (
              <li
                key={step.number}
                className={`calibrate-tour__step ${index % 2 === 1 ? "calibrate-tour__step--reverse" : ""} ${
                  paired ? "calibrate-tour__step--paired" : ""
                }`}
              >
                <div className="calibrate-tour__step-copy">
                  <p className="calibrate-tour__number">{step.number}</p>
                  <h2>{step.title}</h2>
                  <p className="calibrate-tour__explanation">{step.explanation}</p>
                  <p className="calibrate-tour__why">
                    <span>Why this matters</span>
                    {step.why}
                  </p>
                </div>

                <div className={`calibrate-tour__previews ${paired ? "calibrate-tour__previews--paired" : ""}`}>
                  {step.previews.map((preview) => (
                    <ProductPreview key={preview.src} preview={preview} paired={paired} />
                  ))}
                </div>
              </li>
            );
          })}
        </ol>

        <footer className="calibrate-tour__completion">
          <p className="calibrate-start__eyebrow">Your turn</p>
          <h2>Ready to run your first experiment?</h2>
          <p>Start with a few quick questions. We’ll take it from there.</p>
          <div className="calibrate-tour__completion-actions">
            <Link href="/onboarding" className="calibrate-button calibrate-button-dark">
              Start onboarding <span aria-hidden="true">→</span>
            </Link>
            <Link href="/start" className="calibrate-button calibrate-button-outline">
              Back
            </Link>
          </div>
        </footer>
      </div>
    </section>
  );
}