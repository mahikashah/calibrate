"use client";

import { useEffect } from "react";

const STAGGER_MS = 180;

// Reveals elements matching `selector` as they scroll into view, always in document
// order: reaching card 3 also reveals any earlier card that hasn't shown yet.
export function ScrollReveal({ selector }: { selector: string }) {
  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>(selector));
    let revealed = 0;
    let nextSlot = 0;

    const revealThrough = (index: number) => {
      for (; revealed <= index; revealed++) {
        const el = items[revealed];
        const now = performance.now();
        const delay = Math.max(0, nextSlot - now);
        nextSlot = now + delay + STAGGER_MS;
        el.style.transitionDelay = `${delay}ms`;
        el.classList.add("is-revealed");
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          revealThrough(items.indexOf(entry.target as HTMLElement));
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [selector]);

  return null;
}
