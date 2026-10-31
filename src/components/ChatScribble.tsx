// Two chat messages: a friend asks, the student explains. Each shows a typing
// indicator first, then the bubble pops in. Pure CSS timing.

export function ChatScribble() {
  return (
    <div className="chat-scribble" aria-hidden="true">
      <div className="chat-scribble__row chat-scribble__row--them">
        <span className="chat-scribble__avatar" />
        <div className="chat-scribble__slot">
          <span className="chat-scribble__typing">
            <span />
            <span />
            <span />
          </span>
          <p className="chat-scribble__bubble">Can you explain what osmosis is to me?</p>
        </div>
      </div>

      <div className="chat-scribble__row chat-scribble__row--me">
        <div className="chat-scribble__slot">
          <span className="chat-scribble__typing">
            <span />
            <span />
            <span />
          </span>
          <p className="chat-scribble__bubble">
            Yes I can! <span className="chat-scribble__brand">Calibrate</span> helped me
          </p>
        </div>
        <span className="chat-scribble__avatar" />
      </div>
    </div>
  );
}
