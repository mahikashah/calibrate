import type { Metadata } from "next";
import { MobileNav, Sidebar } from "@/components/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudyCoach — find the study techniques that work for you",
  description:
    "An AI-assisted study coach that runs evidence-based techniques as experiments and lets your own data pick the winner.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto flex min-h-screen w-full max-w-6xl gap-8 px-4 py-6 md:px-8">
          <div className="sticky top-6 hidden h-[calc(100vh-3rem)] shrink-0 md:block">
            <Sidebar />
          </div>
          <main className="min-w-0 flex-1 pb-24">
            <MobileNav />
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
