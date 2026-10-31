"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountControl } from "@/components/AccountControl";
import { ChevronRight } from "@/components/icons";
import { SidebarBuddy } from "@/components/SidebarBuddy";

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
    <aside className="flex h-full w-full flex-col gap-1 md:w-64 lg:w-72">
      <Link href="/dashboard" className="group mb-10 flex items-center gap-3 px-2">
        <CalibrateMark />
        <span className="font-serif text-[1.35rem] font-semibold tracking-tight text-ink">
          Calibrate
        </span>
      </Link>

      <nav className="flex flex-col gap-1" aria-label="Main">
        {NAV.map((item) => {
          const active = isActive(path, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`group relative flex items-center justify-between rounded-lg px-4 py-3 text-[0.95rem] font-medium duration-300 ease-smooth focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                active
                  ? "bg-brand-soft text-brand-ink shadow-[inset_0_0_0_1px_rgba(63,129,125,0.14)]"
                  : "text-muted hover:translate-x-0.5 hover:bg-brand-soft/50 hover:text-ink"
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute inset-y-2 left-0 w-[3px] origin-center rounded-full bg-brand transition-transform duration-300 ease-smooth ${
                  active ? "scale-y-100" : "scale-y-0"
                }`}
              />
              {item.label}
              <ChevronRight
                size={14}
                className={`transition duration-300 ease-smooth ${
                  active
                    ? "translate-x-0 opacity-100"
                    : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-60"
                }`}
              />
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-1 items-center justify-center py-6">
        <SidebarBuddy />
      </div>

      <div className="space-y-4 px-3 pt-8">
        <p className="text-sm leading-relaxed text-muted">
          Test techniques as experiments. Let your own results decide what works.
        </p>
        <Link
          href="/onboarding"
          className="block text-sm font-medium text-muted underline decoration-line underline-offset-4 transition-colors hover:text-brand-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Retake onboarding
        </Link>
        <AccountControl />
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
      <AccountControl compact />
      <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Main">
        {NAV.map((item) => {
          const active = isActive(path, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`min-h-10 shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                active
                  ? "bg-brand-soft text-brand-ink shadow-[inset_0_0_0_1px_rgba(63,129,125,0.14)]"
                  : "text-muted hover:bg-brand-soft/50 hover:text-ink"
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
