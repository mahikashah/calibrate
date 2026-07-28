"use client";

import { useEffect, useMemo, useState } from "react";
import { Empty } from "@/components/ui";
import { getJSON, postJSON } from "@/lib/client";

interface Subject {
  id: string;
  name: string;
  color: string;
}

const SWATCHES = ["#4F46B8", "#0E7C66", "#B26A00", "#B23A48", "#2563A6", "#6D28A6"];

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<{ subjectId: string }[]>([]);
  const [questions, setQuestions] = useState<{ subjectId: string }[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const [saving, setSaving] = useState(false);

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
                <div className="min-w-0">
                  <p className="truncate font-semibold tracking-tight">{s.name}</p>
                  <p className="stat text-xs text-muted">
                    {counts[s.id]?.sessions ?? 0} sessions · {counts[s.id]?.questions ?? 0} questions
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
