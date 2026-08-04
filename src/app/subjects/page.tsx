"use client";

import { useEffect, useMemo, useState } from "react";
import { Empty } from "@/components/ui";
import { deleteJSON, getJSON, postJSON } from "@/lib/client";

interface Subject {
  id: string;
  name: string;
  color: string;
}

const SWATCHES = ["#27834F", "#208B8B", "#70B8B8", "#91A88D", "#A16B2B", "#536A55"];

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<{ subjectId: string }[]>([]);
  const [questions, setQuestions] = useState<{ subjectId: string }[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const [saving, setSaving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function refresh() {
    const [subs, ses, qs] = await Promise.all([
      getJSON<Subject[]>("/api/subjects"),
      getJSON<{ subjectId: string }[]>("/api/sessions"),
      getJSON<{ subjectId: string }[]>("/api/questions"),
    ]);
    setSubjects(subs);
    setSessions(ses);
    setQuestions(qs);
  }

  useEffect(() => {
    refresh();
  }, []);

  const counts = useMemo(() => {
    const m: Record<string, { sessions: number; questions: number }> = {};
    for (const s of subjects) m[s.id] = { sessions: 0, questions: 0 };
    for (const s of sessions) if (m[s.subjectId]) m[s.subjectId].sessions++;
    for (const q of questions) if (m[q.subjectId]) m[q.subjectId].questions++;
    return m;
  }, [subjects, sessions, questions]);

  async function create() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await postJSON("/api/subjects", { name: name.trim(), color });
      setName("");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function deleteSubject(id: string, subjectName: string) {
    setDeleteError(null);
    if (!confirm(`Delete "${subjectName}"? This cannot be undone.`)) return;
    try {
      await deleteJSON(`/api/subjects/${id}`);
      await refresh();
    } catch (err) {
      setDeleteError((err as Error).message);
    }
  }

  return (
    <div className="animate-rise space-y-8">
      <header>
        <p className="label mb-1">Subjects</p>
        <h1 className="text-2xl font-semibold tracking-tight">What are you studying?</h1>
      </header>

      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold tracking-tight">Add a subject</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="label mb-1 block">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="e.g. Organic Chemistry"
              className="field"
            />
          </div>
          <div>
            <label className="label mb-1 block">Color</label>
            <div className="flex gap-1.5">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-lg border-2 transition-transform ${
                    color === c ? "scale-110 border-ink" : "border-transparent"
                  }`}
                  style={{ background: c }}
                  aria-label={`color ${c}`}
                />
              ))}
            </div>
          </div>
          <button onClick={create} disabled={saving || !name.trim()} className="btn-primary">
            {saving ? "Adding…" : "Add subject"}
          </button>
        </div>
      </section>

      {deleteError && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
          {deleteError}
        </div>
      )}

      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">
          Your subjects
          <span className="ml-2 stat text-sm font-normal text-muted">{subjects.length}</span>
        </h2>
        {subjects.length === 0 ? (
          <Empty title="No subjects yet">Add your first subject above to start tracking.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((s) => (
              <div key={s.id} className="card flex items-center gap-3 p-5">
                <span
                  className="h-10 w-1.5 shrink-0 rounded-full"
                  style={{ background: s.color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold tracking-tight">{s.name}</p>
                  <p className="stat text-xs text-muted">
                    {counts[s.id]?.sessions ?? 0} sessions · {counts[s.id]?.questions ?? 0} questions
                  </p>
                </div>
                <button
                  onClick={() => deleteSubject(s.id, s.name)}
                  aria-label={`Delete ${s.name}`}
                  className="ml-auto shrink-0 rounded p-1.5 text-muted opacity-0 transition-opacity hover:text-red-600 focus:opacity-100 group-hover:opacity-100 [.card:hover_&]:opacity-100"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
