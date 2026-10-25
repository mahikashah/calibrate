"use client";

import { useEffect, useState } from "react";

type Me = { authenticated: boolean; mode: string; email?: string | null; demo?: boolean };

/** Shows who is signed in and a sign-out button. Renders nothing in local mode. */
export function AccountControl({ compact = false }: { compact?: boolean }) {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Me | null) => {
        if (!cancelled) setMe(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!me || !me.authenticated) return null;

  async function signOut() {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } finally {
      window.location.assign("/start");
    }
  }

  const label = me.demo ? "Demo account" : me.email;
  return (
    <div className={compact ? "flex items-center gap-2 text-xs" : "space-y-1 text-sm"}>
      <p className="truncate text-muted" title={label ?? undefined}>
        {label}
      </p>
      <button
        type="button"
        onClick={() => void signOut()}
        className="font-medium text-muted underline decoration-line underline-offset-4 transition-colors hover:text-brand-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        Sign out
      </button>
    </div>
  );
}
