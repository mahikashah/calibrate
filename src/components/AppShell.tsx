"use client";

import { usePathname } from "next/navigation";
import { MobileNav, Sidebar } from "@/components/Sidebar";

// First-time / setup experience — no product sidebar.
const STANDALONE_ROUTES = new Set(["/start", "/how-it-works", "/onboarding"]);

// Post-session check-in continues the study flow without chrome.
const FOCUSED_ROUTES = new Set(["/feedback"]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (STANDALONE_ROUTES.has(pathname)) {
    return <main>{children}</main>;
  }

  if (FOCUSED_ROUTES.has(pathname)) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-3xl px-4 py-6 md:px-8">
        <main className="min-w-0 pb-16">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full">
      <div className="sticky top-0 hidden h-screen shrink-0 border-r border-line bg-surface px-5 py-8 md:block">
        <Sidebar />
      </div>
      <main className="mx-auto min-w-0 w-full max-w-7xl flex-1 px-4 pb-24 pt-6 md:px-10 md:pt-8">
        <MobileNav />
        {children}
      </main>
    </div>
  );
}
