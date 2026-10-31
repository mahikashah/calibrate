"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronRight } from "@/components/icons";
import { safeNextPath } from "@/lib/auth/safe-next";

function CalibrateMark() {
  return (
    <span aria-hidden="true" className="calibrate-bar-mark">
      <span />
      <span />
      <span />
    </span>
  );
}

async function postAuth<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Something went wrong. Please try again.");
  return data as T;
}

function SignInForm() {
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { isNew } = await postAuth<{ isNew: boolean }>("/api/auth/signin", { email });
      window.location.assign(next ?? (isNew ? "/onboarding" : "/dashboard"));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function tryDemo() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await postAuth("/api/auth/demo");
      window.location.assign("/dashboard");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <section className="calibrate-start">
      <div className="calibrate-start__orb calibrate-start__orb--top" aria-hidden="true" />
      <div className="calibrate-start__orb calibrate-start__orb--bottom" aria-hidden="true" />
      <div className="calibrate-start__grid" aria-hidden="true" />

      <div className="calibrate-start__content animate-rise">
        <div className="calibrate-start__hero calibrate-signin">
          <header className="calibrate-start__brand calibrate-start__brand--centered">
            <CalibrateMark />
            <span>Calibrate</span>
          </header>
          <p className="calibrate-start__eyebrow">Student pilot</p>
          <h1>Sign in to continue.</h1>
          <p className="calibrate-start__lede">
            Enter your email to save your subjects, questions, and study results so you can come
            back to them. No password needed.
          </p>

          <form className="calibrate-signin__form" onSubmit={(e) => void submit(e)} noValidate>
            <label htmlFor="email" className="calibrate-signin__label">
              Email address
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu"
              className="calibrate-signin__input"
              aria-describedby="signin-note"
            />
            {error ? (
              <p role="alert" className="calibrate-signin__error">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="calibrate-button calibrate-button-dark"
            >
              {busy ? "Signing in…" : "Continue"} <ChevronRight className="nudge" />
            </button>
            <p id="signin-note" className="calibrate-signin__note">
              During this pilot, signing in uses only your email, so anyone who knows it could open
              your account. Don&rsquo;t share sensitive notes you wouldn&rsquo;t want a classmate to
              see. We use your email to sign you in and, if you agree, to follow up about your
              experience.
            </p>
          </form>

          <button
            type="button"
            onClick={() => void tryDemo()}
            disabled={busy}
            className="calibrate-start__return calibrate-signin__demo"
          >
            Just looking? Explore the shared demo account <ChevronRight className="nudge" />
          </button>
        </div>
      </div>
    </section>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
