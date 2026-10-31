"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "loading" | "done" | "fading";

/**
 * A thin progress bar at the top of the window during client-side navigation.
 * The App Router has no route-change events, so this starts on internal link
 * clicks and finishes when the pathname or query string changes.
 */
export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const timers = useRef<number[]>([]);

  function clearTimers() {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      clearTimers();
      setPhase("loading");
      setProgress(0.15);
      timers.current.push(window.setTimeout(() => setProgress(0.45), 120));
      timers.current.push(window.setTimeout(() => setProgress(0.7), 600));
      timers.current.push(window.setTimeout(() => setProgress(0.85), 1600));
    }
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      clearTimers();
    };
  }, []);

  useEffect(() => {
    if (phase !== "loading") return;
    clearTimers();
    setProgress(1);
    setPhase("done");
    timers.current.push(window.setTimeout(() => setPhase("fading"), 250));
    timers.current.push(
      window.setTimeout(() => {
        setPhase("idle");
        setProgress(0);
      }, 600),
    );
    // Only route changes should finish the bar, so `phase` is deliberately not a dependency.
  }, [pathname, searchParams]);

  return (
    <div
      aria-hidden="true"
      className="nav-progress"
      style={{
        transform: `scaleX(${progress})`,
        opacity: phase === "loading" || phase === "done" ? 1 : 0,
        // Reset instantly once hidden so the bar never visibly shrinks.
        transition: phase === "idle" ? "none" : undefined,
      }}
    />
  );
}
