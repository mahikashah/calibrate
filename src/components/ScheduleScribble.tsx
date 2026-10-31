// A week view where four study sessions start crammed into Sunday, then spread
// out across the week and get checked off. Pure CSS timing.

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
// Final day column for each session; they all start stacked in Sunday (column 6).
const SESSIONS = [0, 2, 4, 6];

export function ScheduleScribble() {
  return (
    <div className="schedule-scribble" aria-hidden="true">
      <div className="schedule-scribble__head">
        <span className="schedule-scribble__title">This week</span>
        <span className="schedule-scribble__labels">
          <span className="schedule-scribble__label schedule-scribble__label--cram">Cram night 😬</span>
          <span className="schedule-scribble__label schedule-scribble__label--spread">Spread out ✓</span>
        </span>
      </div>
      <div className="schedule-scribble__days">
        {DAYS.map((day, i) => (
          <span key={i}>{day}</span>
        ))}
      </div>
      <div className="schedule-scribble__grid">
        {SESSIONS.map((col, i) => (
          <span
            key={col}
            className="schedule-scribble__session"
            style={{
              gridColumn: col + 1,
              ["--i" as string]: i,
              ["--dx" as string]: `${(6 - col) * 100}%`,
              ["--dy" as string]: `${(i - 1) * 100}%`,
            }}
          >
            <span className="schedule-scribble__pill">
              <span className="schedule-scribble__check">✓</span>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
