"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard", hint: "01" },
  { href: "/onboarding", label: "Onboarding", hint: "02" },
  { href: "/study", label: "Study session", hint: "03" },
  { href: "/questions", label: "Question bank", hint: "04" },
  { href: "/insights", label: "Insights", hint: "05" },
  { href: "/subjects", label: "Subjects", hint: "06" },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="flex h-full w-full flex-col gap-1 md:w-64">
      <Link href="/" className="mb-6 flex items-center gap-2.5 px-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white shadow-card">
          <span className="font-mono text-sm font-bold">C</span>
        </span>
        <span className="text-[15px] font-semibold tracking-tight">
          Calibrate
        </span>
      </Link>

      <nav className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active ? "bg-brand-soft text-brand-ink" : "text-muted hover:bg-brand-soft/60 hover:text-ink"
              }`}
            >
              <span className={`font-mono text-[11px] ${active ? "text-brand" : "text-muted/60"}`}>
                {item.hint}
              </span>
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto hidden px-3 pt-6 md:block">
        <p className="label mb-1">Method</p>
        <p className="text-xs leading-relaxed text-muted">
          No learning-style labels. Calibrate runs techniques as experiments and lets your own
          data pick the winner.
        </p>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const path = usePathname();
  return (
    <div className="mb-4 flex items-center gap-3 md:hidden">
      <Link href="/" className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-white">
          <span className="font-mono text-xs font-bold">C</span>
        </span>
        <span className="text-sm font-semibold tracking-tight">Calibrate</span>
      </Link>
      <nav className="-mx-1 flex flex-1 gap-1 overflow-x-auto px-1">
        {NAV.map((item) => {
          const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                active ? "bg-brand-soft text-brand-ink" : "text-muted"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
