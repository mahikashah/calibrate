"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { NavProgress } from "@/components/NavProgress";
import { MobileNav, Sidebar } from "@/components/Sidebar";

// First-time / setup experience — no product sidebar.
const STANDALONE_ROUTES = new Set(["/", "/start", "/how-it-works", "/onboarding", "/signin"]);

// Post-session check-in continues the study flow without chrome.
const FOCUSED_ROUTES = new Set(["/feedback"]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const progress = (
    <Suspense fallback={null}>
      <NavProgress />
    </Suspense>
  );

  if (STANDALONE_ROUTES.has(pathname)) {
    return (
      <>
        {progress}
        <main className="calibrate-standalone">{children}</main>
      </>
    );
  }

  if (FOCUSED_ROUTES.has(pathname)) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-3xl px-4 py-6 md:px-8">
        {progress}
        <main className="min-w-0 pb-16">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full">
      {progress}
      <div className="sticky top-0 hidden h-screen shrink-0 border-r border-line/80 bg-surface/80 px-5 py-8 backdrop-blur-xl md:block">
        <Sidebar />
      </div>
      <main className="mx-auto min-w-0 w-full max-w-7xl flex-1 px-4 pb-24 pt-6 md:px-10 md:pt-8">
        <MobileNav />
        {children}
      </main>
    </div>
  );
}
