// Three subject cards (coding, math, vocab) rotating through the center spot on a
// loop. Each card runs the same keyframes, offset by a third of the cycle.

export function SubjectCarousel() {
  return (
    <div className="subject-carousel" aria-hidden="true">
      <div className="subject-carousel__stage">
        <div className="subject-carousel__card subject-carousel__card--code" style={{ ["--n" as string]: 0 }}>
          <span className="subject-carousel__tag">Coding</span>
          <pre>
            <span className="tok-key">def</span> <span className="tok-fn">study</span>(notes):{"\n"}
            {"  "}<span className="tok-key">for</span> q <span className="tok-key">in</span> notes:{"\n"}
            {"    "}recall(q) <span className="tok-com"># ✓</span>
          </pre>
        </div>

        <div className="subject-carousel__card subject-carousel__card--math" style={{ ["--n" as string]: 1 }}>
          <span className="subject-carousel__tag">Math</span>
          <div className="subject-carousel__math">
            <svg viewBox="0 0 60 44">
              <path d="M6 38 L54 38 L54 6 Z" />
              <path d="M48 38 L48 32 L54 32" />
            </svg>
            <span>
              a² + b² = c²
            </span>
          </div>
        </div>

        <div className="subject-carousel__card subject-carousel__card--vocab" style={{ ["--n" as string]: 2 }}>
          <span className="subject-carousel__tag">Vocab</span>
          <p className="subject-carousel__word">ephemeral</p>
          <p className="subject-carousel__def">(adj.) lasting a very short time</p>
        </div>
      </div>
      <div className="subject-carousel__dots">
        <span style={{ ["--n" as string]: 0 }} />
        <span style={{ ["--n" as string]: 1 }} />
        <span style={{ ["--n" as string]: 2 }} />
      </div>
    </div>
  );
}
