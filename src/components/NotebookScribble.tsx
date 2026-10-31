// A notebook page that writes itself, line by line, with a pencil following the ink.
// Pure CSS: each line is revealed with a stepped clip-path so it reads as handwriting.

const LINES = [
  { text: "Ch. 4 — Cell biology", className: "notebook-scribble__line--title" },
  { text: "mitochondria → makes ATP" },
  { text: "osmosis: high → low conc." },
  { text: "re-read before the quiz!!", className: "notebook-scribble__line--note" },
];

export function NotebookScribble() {
  return (
    <div className="notebook-scribble" aria-hidden="true">
      <div className="notebook-scribble__rings">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} />
        ))}
      </div>
      <div className="notebook-scribble__page">
        {LINES.map((line, i) => (
          <div key={line.text} className="notebook-scribble__row">
            <span
              className={`notebook-scribble__line ${line.className ?? ""}`}
              style={{ ["--i" as string]: i, ["--chars" as string]: line.text.length }}
            >
              <span className="notebook-scribble__ink">{line.text}</span>
              <span className="notebook-scribble__pencil" />
            </span>
          </div>
        ))}
        <svg className="notebook-scribble__underline" viewBox="0 0 160 12" preserveAspectRatio="none">
          <path d="M2 8 C 30 2, 50 11, 80 6 S 130 3, 158 7" />
        </svg>
        <svg className="notebook-scribble__star" viewBox="0 0 24 24">
          <path d="M12 2.5l2.6 6.2 6.7.5-5.1 4.4 1.6 6.5L12 16.6l-5.8 3.5 1.6-6.5-5.1-4.4 6.7-.5z" />
        </svg>
      </div>
    </div>
  );
}
