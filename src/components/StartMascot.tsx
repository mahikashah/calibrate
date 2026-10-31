"use client";

import { useEffect, useRef, useState } from "react";

const MASCOT_SRC = "/mascot.png";
const MASCOT_VIDEO_SRC = "/mascot-wave.mp4";

// Greets once the intro has settled, then nudges toward the CTA. Clicking replays it.
const LINES = [
  { text: "Hi! 👋", at: 1600 },
  { text: "Ready to start calibrating?", at: 3800 },
];

export function StartMascot() {
  const [hasVideo, setHasVideo] = useState(true);
  const [line, setLine] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  function greet(offset = 0) {
    timers.current.forEach(clearTimeout);
    setLine(null);
    timers.current = LINES.map(({ text, at }) => setTimeout(() => setLine(text), at - offset));
  }

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      videoRef.current?.pause();
    }
    greet();
    return () => timers.current.forEach(clearTimeout);
  }, []);

  return (
    <button
      type="button"
      className="calibrate-mascot"
      onClick={() => greet(1400)}
      aria-label="Calibrate mascot. Click to say hi again"
    >
      <span className="calibrate-mascot__body">
        {hasVideo ? (
          <video
            ref={videoRef}
            className="calibrate-mascot__video"
            src={MASCOT_VIDEO_SRC}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            onError={() => setHasVideo(false)}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={MASCOT_SRC} alt="" draggable={false} />
        )}
      </span>
      <span className={`calibrate-mascot__hi${line ? " is-visible" : ""}`} aria-live="polite">
        {line}
      </span>
    </button>
  );
}
