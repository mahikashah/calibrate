"use client";

import { usePathname } from "next/navigation";
import { MobileNav, Sidebar } from "@/components/Sidebar";

// Routes that render without the application sidebar/nav shell.
const STANDALONE_ROUTES = new Set(["/start", "/how-it-works", "/onboarding"]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (STANDALONE_ROUTES.has(pathname)) {
    return <main>{children}</main>;
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl gap-8 px-4 py-6 md:px-8">
      <div className="sticky top-6 hidden h-[calc(100vh-3rem)] shrink-0 md:block">
        <Sidebar />
      </div>
      <main className="min-w-0 flex-1 pb-24">
        <MobileNav />
        {children}
      </main>
    </div>
  );
}
