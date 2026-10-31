// A quiz sheet where the answer starts, gets scribbled out, and a thought bubble
// admits the student forgot. Pure CSS timing, same handwriting approach as NotebookScribble.

const THOUGHT = ["I don't know the answer!", "I forgot..."];

export function TestPaperScribble() {
  return (
    <div className="test-scribble" aria-hidden="true">
      <div className="test-scribble__paper">
        <div className="test-scribble__head">
          <span className="test-scribble__title">Quiz · Ch. 4</span>
          <span className="test-scribble__name">
            Name <span className="test-scribble__blank" />
          </span>
        </div>

        <p className="test-scribble__q">1. What does the mitochondria make?</p>
        <div className="test-scribble__answer">
          <span className="test-scribble__hand test-scribble__hand--a1" style={{ ["--chars" as string]: 14 }}>
            <span className="test-scribble__ink">umm… it makes</span>
            <span className="test-scribble__pencil" />
          </span>
          <svg className="test-scribble__strike" viewBox="0 0 120 16" preserveAspectRatio="none">
            <path d="M2 9 L10 4 L18 12 L26 4 L34 12 L42 4 L50 12 L58 4 L66 12 L74 4 L82 12 L90 4 L98 12 L106 4 L118 9" />
          </svg>
        </div>

        <p className="test-scribble__q">2. Define osmosis.</p>
        <div className="test-scribble__answer">
          <span className="test-scribble__mark" style={{ ["--n" as string]: 0 }}>?</span>
          <span className="test-scribble__mark" style={{ ["--n" as string]: 1 }}>??</span>
        </div>
      </div>

      <div className="test-scribble__thought">
        <span className="test-scribble__puff test-scribble__puff--sm" />
        <span className="test-scribble__puff test-scribble__puff--md" />
        <div className="test-scribble__bubble">
          {THOUGHT.map((line, i) => (
            <span
              key={line}
              className="test-scribble__thought-line"
              style={{ ["--i" as string]: i, ["--chars" as string]: line.length }}
            >
              {line}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
