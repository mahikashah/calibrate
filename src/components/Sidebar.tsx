"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/subjects", label: "Subjects" },
  { href: "/questions", label: "Question Bank" },
  { href: "/study", label: "Study" },
  { href: "/insights", label: "Insights" },
] as const;

function CalibrateMark({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span aria-hidden="true" className={`calibrate-bar-mark${size === "sm" ? " calibrate-bar-mark--sm" : ""}`}>
      <span />
      <span />
      <span />
    </span>
  );
}

function isActive(path: string, href: string) {
  if (href === "/dashboard") return path === "/dashboard";
  return path === href || path.startsWith(`${href}/`);
}

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="flex h-full w-full flex-col gap-1 md:w-60">
      <Link href="/dashboard" className="mb-7 flex items-center gap-2.5 px-2">
        <CalibrateMark />
        <span className="font-serif text-[1.05rem] font-semibold tracking-tight text-ink">
          Calibrate
        </span>
      </Link>

      <nav className="flex flex-col gap-0.5" aria-label="Main">
        {NAV.map((item) => {
          const active = isActive(path, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-lg border-l-[3px] px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                active
                  ? "border-brand bg-brand-soft text-brand-ink"
                  : "border-transparent text-muted hover:bg-brand-soft/50 hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-4 px-3 pt-8">
        <p className="text-xs leading-relaxed text-muted">
          Test techniques as experiments. Let your own results decide what works.
        </p>
        <Link
          href="/onboarding"
          className="block text-xs font-medium text-muted underline decoration-line underline-offset-4 transition-colors hover:text-brand-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Retake onboarding
        </Link>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const path = usePathname();
  return (
    <div className="mb-5 space-y-3 md:hidden">
      <div className="flex items-center justify-between gap-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <CalibrateMark size="sm" />
          <span className="font-serif text-sm font-semibold tracking-tight">Calibrate</span>
        </Link>
        <Link
          href="/onboarding"
          className="text-xs font-medium text-muted underline decoration-line underline-offset-4"
        >
          Retake onboarding
        </Link>
      </div>
      <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Main">
        {NAV.map((item) => {
          const active = isActive(path, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`min-h-10 shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
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
