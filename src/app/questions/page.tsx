"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AiTag, Empty } from "@/components/ui";
import { getJSON, postJSON } from "@/lib/client";

interface Subject {
  id: string;
  name: string;
}
interface Question {
  id: string;
  subjectId: string;
  type: string;
  prompt: string;
  answer: string;
  source: string;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  recall: "Active recall",
  practice: "Practice",
  feynman: "Explain-back",
  cloze: "Fill-in",
};

export default function QuestionsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [filter, setFilter] = useState("all");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [count, setCount] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [fellBack, setFellBack] = useState(false);

  async function refresh() {
    const [subs, qs] = await Promise.all([
      getJSON<Subject[]>("/api/subjects"),
      getJSON<Question[]>("/api/questions"),
    ]);
    setSubjects(subs);
    setQuestions(qs);
    if (subs[0] && !subjectId) setSubjectId(subs[0].id);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    if (!subjectId || !content.trim()) return;
    setGenerating(true);
    try {
      const subjectName = subjects.find((s) => s.id === subjectId)?.name;
      // Save the material, then generate questions from it.
      const material = await postJSON<{ id: string }>("/api/materials", {
        subjectId,
        title: title.trim() || "Untitled material",
        content,
      });
      const res = await postJSON<{ provider: string; fellBack: boolean }>(
        "/api/questions/generate",
        { subjectId, subjectName, materialId: material.id, count },
      );
      setProvider(res.provider);
      setFellBack(res.fellBack);
      setTitle("");
      setContent("");
      await refresh();
    } finally {
      setGenerating(false);
    }
  }

  const visible = useMemo(
    () => questions.filter((q) => filter === "all" || q.type === filter),
    [questions, filter],
  );

  return (
    <div className="animate-rise space-y-8">
      <header>
        <p className="label mb-1">Question bank</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Turn your material into practice
        </h1>
      </header>

      {subjects.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="mb-1 text-sm font-semibold">Add a subject first</p>
          <p className="mb-4 text-sm text-muted">Questions are organized by subject.</p>
          <Link href="/subjects" className="btn-primary">
            Create a subject
          </Link>
        </div>
      ) : (
        <section className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">Generate from your notes</h2>
            <AiTag provider={provider ?? undefined} />
          </div>
          <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
            <div className="space-y-3">
              <div>
                <label className="label mb-1 block">Subject</label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="field"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label mb-1 block">How many</label>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="field"
                />
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Material title"
                className="field"
              />
            </div>
            <div>
              <label className="label mb-1 block">Paste your material</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                placeholder="Paste lecture notes, a textbook section, or your own summary. Questions are generated only from this text."
                className="field resize-none"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={generate}
              disabled={generating || !content.trim()}
              className="btn-primary"
            >
              {generating ? "Generating…" : "Generate questions"}
            </button>
            {fellBack && (
              <span className="text-xs text-emerging">
                Model unavailable — used the built-in offline generator instead.
              </span>
            )}
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Saved questions
            <span className="ml-2 stat text-sm font-normal text-muted">{questions.length}</span>
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {["all", "recall", "cloze", "feynman", "practice"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  filter === f ? "bg-brand text-white" : "border border-line bg-surface text-muted"
                }`}
              >
                {f === "all" ? "All" : TYPE_LABEL[f]}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <Empty title="No questions yet">
            Paste some material above and generate your first set — or add one by hand.
          </Empty>
        ) : (
          <div className="space-y-3">
            {visible.map((q) => (
              <QuestionCard key={q.id} q={q} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function QuestionCard({ q }: { q: Question }) {
  const [revealed, setRevealed] = useState(false);
  const [practicing, setPracticing] = useState(false);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function getFeedback() {
    if (!answer.trim()) return;
    setLoading(true);
    try {
      const res = await postJSON<{ feedback: string }>("/api/feedback", {
        question: q.prompt,
        expected: q.answer,
        answer,
      });
      setFeedback(res.feedback);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="chip">{TYPE_LABEL[q.type] ?? q.type}</span>
        {q.source === "ai" && (
          <span className="font-mono text-[10px] uppercase tracking-wider text-brand">ai</span>
        )}
      </div>
      <p className="text-sm font-medium leading-relaxed">{q.prompt}</p>

      <div className="mt-3 flex flex-wrap gap-4 text-xs">
        <button onClick={() => setRevealed((v) => !v)} className="text-brand hover:underline">
          {revealed ? "Hide answer" : "Reveal answer"}
        </button>
        <button
          onClick={() => setPracticing((v) => !v)}
          className="text-brand hover:underline"
        >
          {practicing ? "Cancel practice" : "Practice this"}
        </button>
      </div>

      {revealed && q.answer && (
        <p className="mt-3 rounded-lg bg-paper p-3 text-sm leading-relaxed text-muted">{q.answer}</p>
      )}

      {practicing && (
        <div className="mt-3 space-y-3">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={3}
            placeholder="Answer from memory, then get feedback…"
            className="field resize-none"
          />
          <button onClick={getFeedback} disabled={loading} className="btn-ghost text-sm">
            {loading ? "Checking…" : "Get feedback"}
          </button>
          {feedback && (
            <div className="rounded-lg border border-brand/20 bg-brand-soft p-3 text-sm leading-relaxed text-brand-ink">
              {feedback}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
