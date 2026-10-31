"use client";

import { useEffect, useState } from "react";
import { getJSON } from "@/lib/client";
import { STUDY_BUDDIES, type StudyBuddy } from "@/lib/study-buddies";

const CHEER_MS = 6000;

// The study buddy picked in onboarding, cheering the student on from the sidebar.
// Renders nothing until onboarding has a buddy saved.
export function SidebarBuddy() {
  const [buddy, setBuddy] = useState<StudyBuddy | null>(null);
  const [cheer, setCheer] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getJSON<{ completed: boolean; answers?: Record<string, number> }>("/api/onboarding")
      .then((data) => {
        const index = data.answers?.buddy;
        if (!cancelled && index !== undefined) setBuddy(STUDY_BUDDIES[index] ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!buddy) return;
    const timer = setInterval(() => setCheer((n) => n + 1), CHEER_MS);
    return () => clearInterval(timer);
  }, [buddy, cheer]);

  if (!buddy) return null;
  const line = buddy.cheers[cheer % buddy.cheers.length];

  return (
    <div className="sidebar-buddy">
      <p key={`line-${cheer}`} className="sidebar-buddy__bubble" aria-live="polite">
        {line}
      </p>
      <button
        type="button"
        className="sidebar-buddy__button"
        onClick={() => setCheer((n) => n + 1)}
        aria-label={`${buddy.name}, your study buddy. Click for another cheer`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={`hop-${cheer}`} src={buddy.image} alt="" className="sidebar-buddy__image" draggable={false} />
      </button>
      <p className="sidebar-buddy__name">{buddy.name}</p>
    </div>
  );
}
