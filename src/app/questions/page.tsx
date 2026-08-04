"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AiTag, Empty } from "@/components/ui";
import { deleteJSON, getJSON, postJSON } from "@/lib/client";

interface Subject {
  id: string;
  name: string;
}

interface Question {
  id: string;
  subjectId: string;
  materialId?: string | null;
  type: string;
  prompt: string;
  answer: string;
  source: string;
  createdAt: string;
}

interface Material {
  id: string;
  subjectId: string;
  title: string;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  recall: "Active recall",
  practice: "Practice",
  feynman: "Explain-back",
  cloze: "Fill-in",
};

const FILTERS = ["all", "recall", "cloze", "feynman", "practice"];

export default function QuestionsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [filter, setFilter] = useState("all");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [count, setCount] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [fellBack, setFellBack] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [subs, qs, mats] = await Promise.all([
      getJSON<Subject[]>("/api/subjects"),
      getJSON<Question[]>("/api/questions"),
      getJSON<Material[]>("/api/materials"),
    ]);
    setSubjects(subs);
    setQuestions(qs);
    setMaterials(mats);
    if (subs[0] && !subjectId) setSubjectId(subs[0].id);
  }

  useEffect(() => {
    void refresh();
    // `subjectId` is intentionally read only for initial selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    if (!subjectId || !content.trim()) return;

    setGenerating(true);
    setError(null);
    setProvider(null);
    setFellBack(false);

    try {
      const subjectName = subjects.find((subject) => subject.id === subjectId)?.name;
      // Each submit deliberately creates a new material before generating linked questions.
      const material = await postJSON<{ id: string }>("/api/materials", {
        subjectId,
        title: title.trim() || "Untitled material",
        content,
      });
      const result = await postJSON<{ provider: string; fellBack: boolean }>(
        "/api/questions/generate",
        { subjectId, subjectName, materialId: material.id, count },
      );

      setProvider(result.provider);
      setFellBack(result.fellBack);
      setTitle("");
      setContent("");
      await refresh();
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "We couldn't generate questions right now. Please try again.",
      );
    } finally {
      setGenerating(false);
    }
  }

  const visibleQuestions = useMemo(
    () => questions.filter((question) => filter === "all" || question.type === filter),
    [questions, filter],
  );

  async function deleteMaterial(id: string, matTitle: string) {
    const linkedCount = questions.filter((q) => q.materialId === id).length;
    const confirmMsg = linkedCount > 0
      ? `Delete "${matTitle}" and its ${linkedCount} linked question${linkedCount === 1 ? "" : "s"}? This cannot be undone.`
      : `Delete "${matTitle}"? This cannot be undone.`;
    if (!confirm(confirmMsg)) return;
    await deleteJSON(`/api/materials/${id}`);
    await refresh();
  }

  async function deleteQuestion(id: string) {
    await deleteJSON(`/api/questions/${id}`);
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  return (
    <div className="calibrate-question-bank animate-rise">
      <header className="calibrate-question-bank__header">
        <p className="calibrate-question-bank__eyebrow">Question Bank</p>
        <h1>Turn your material into practice</h1>
        <p className="calibrate-question-bank__intro">
          Paste the material you&apos;re studying today. Calibrate will generate practice questions
          only from this text.
        </p>
      </header>

      {subjects.length === 0 ? (
        <div className="calibrate-empty-state">
          <p className="calibrate-empty-state__title">Add a subject first</p>
          <p>Question sets stay organized by the subject you&apos;re working on.</p>
          <Link href="/subjects" className="calibrate-question-bank__button">
            Create a subject
          </Link>
        </div>
      ) : (
        <section className="calibrate-generator" aria-labelledby="generate-notes-title">
          <div className="calibrate-generator__heading">
            <div>
              <p className="calibrate-question-bank__eyebrow">Paste notes</p>
              <h2 id="generate-notes-title">Make a question set for today</h2>
            </div>
            {provider && <AiTag provider={provider} />}
          </div>

          <div className="calibrate-generator__grid">
            <div className="calibrate-generator__details">
              <div>
                <label className="calibrate-question-bank__label" htmlFor="question-subject">
                  Subject
                </label>
                <select
                  id="question-subject"
                  value={subjectId}
                  onChange={(event) => setSubjectId(event.target.value)}
                  className="calibrate-question-bank__field"
                >
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="calibrate-question-bank__label" htmlFor="question-count">
                  Number of questions
                </label>
                <input
                  id="question-count"
                  type="number"
                  min={1}
                  max={15}
                  value={count}
                  onChange={(event) => {
                    const nextCount = Number(event.target.value);
                    setCount(Number.isFinite(nextCount) ? Math.min(15, Math.max(1, nextCount)) : 1);
                  }}
                  className="calibrate-question-bank__field"
                />
              </div>
            </div>

            <div className="calibrate-generator__notes">
              <div>
                <label className="calibrate-question-bank__label" htmlFor="material-title">
                  Material title
                </label>
                <input
                  id="material-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Week 3 lecture notes"
                  className="calibrate-question-bank__field"
                />
              </div>

              <div>
                <div className="calibrate-notes-label">
                  <label className="calibrate-question-bank__label" htmlFor="material-content">
                    Notes for today
                  </label>
                  <span>{content.length.toLocaleString()} characters</span>
                </div>
                <textarea
                  id="material-content"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  rows={8}
                  placeholder="Paste lecture notes, a textbook section, or your own summary. Questions will be generated only from this text."
                  className="calibrate-question-bank__field calibrate-question-bank__textarea"
                />
              </div>
            </div>
          </div>

          <div className="calibrate-generator__footer">
            <p>Generated questions should be reviewed before they become part of your experiment data.</p>
            <button
              type="button"
              onClick={() => void generate()}
              disabled={generating || !content.trim()}
              className="calibrate-question-bank__button"
            >
              {generating ? "Generating questions…" : "Generate questions"}
            </button>
          </div>

          {error && <p className="calibrate-generator__error">{error}</p>}
          {fellBack && (
            <p className="calibrate-generator__notice">
              Model unavailable — used the built-in offline generator instead.
            </p>
          )}
        </section>
      )}

      {materials.length > 0 && (
        <section className="calibrate-saved-questions" aria-labelledby="saved-materials-title">
          <div className="calibrate-saved-questions__heading">
            <div>
              <p className="calibrate-question-bank__eyebrow">Your library</p>
              <h2 id="saved-materials-title">
                Saved materials <span>{materials.length}</span>
              </h2>
            </div>
          </div>
          <div className="calibrate-question-list">
            {materials.map((mat) => {
              const subject = subjects.find((s) => s.id === mat.subjectId);
              return (
                <article key={mat.id} className="calibrate-question-card">
                  <div className="calibrate-question-card__meta">
                    <span>{subject?.name ?? "Unknown subject"}</span>
                    <span>{new Date(mat.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="calibrate-question-card__prompt">{mat.title}</p>
                  <div className="calibrate-question-card__actions">
                    <button
                      type="button"
                      onClick={() => void deleteMaterial(mat.id, mat.title)}
                      className="calibrate-question-card__delete"
                    >
                      Delete material
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="calibrate-saved-questions" aria-labelledby="saved-questions-title">
        <div className="calibrate-saved-questions__heading">
          <div>
            <p className="calibrate-question-bank__eyebrow">Your library</p>
            <h2 id="saved-questions-title">
              Saved questions <span>{questions.length}</span>
            </h2>
          </div>

          <div className="calibrate-question-filters" aria-label="Filter saved questions">
            {FILTERS.map((value) => (
              <button
                type="button"
                key={value}
                onClick={() => setFilter(value)}
                className={filter === value ? "is-active" : ""}
              >
                {value === "all" ? "All" : TYPE_LABEL[value]}
              </button>
            ))}
          </div>
        </div>

        {visibleQuestions.length === 0 ? (
          <Empty title={questions.length ? "No questions match this filter" : "No questions yet"}>
            Paste some material above and generate your first set.
          </Empty>
        ) : (
          <div className="calibrate-question-list">
            {visibleQuestions.map((question) => (
              <QuestionCard key={question.id} question={question} onDelete={deleteQuestion} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function QuestionCard({
  question,
  onDelete,
}: {
  question: Question;
  onDelete: (id: string) => Promise<void>;
}) {
  const [revealed, setRevealed] = useState(false);
  const [practicing, setPracticing] = useState(false);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function getFeedback() {
    if (!answer.trim()) return;
    setLoading(true);

    try {
      const result = await postJSON<{ feedback: string }>("/api/feedback", {
        question: question.prompt,
        expected: question.answer,
        answer,
      });
      setFeedback(result.feedback);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this question? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await onDelete(question.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article className="calibrate-question-card">
      <div className="calibrate-question-card__meta">
        <span>{TYPE_LABEL[question.type] ?? question.type}</span>
        <span>{question.source === "ai" ? "AI" : "User"}</span>
      </div>
      <p className="calibrate-question-card__prompt">{question.prompt}</p>

      <div className="calibrate-question-card__actions">
        <button type="button" onClick={() => setRevealed((isRevealed) => !isRevealed)}>
          {revealed ? "Hide answer" : "Reveal answer"}
        </button>
        <button type="button" onClick={() => setPracticing((isPracticing) => !isPracticing)}>
          {practicing ? "Cancel practice" : "Practice this"}
        </button>
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={deleting}
          className="calibrate-question-card__delete"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>

      {revealed && question.answer && (
        <p className="calibrate-question-card__answer">{question.answer}</p>
      )}

      {practicing && (
        <div className="calibrate-question-card__practice">
          <textarea
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            rows={3}
            placeholder="Answer from memory, then get feedback…"
            className="calibrate-question-bank__field calibrate-question-bank__textarea"
          />
          <button
            type="button"
            onClick={() => void getFeedback()}
            disabled={loading || !answer.trim()}
            className="calibrate-question-card__feedback"
          >
            {loading ? "Checking…" : "Get feedback"}
          </button>
          {feedback && <div className="calibrate-question-card__feedback-result">{feedback}</div>}
        </div>
      )}
    </article>
  );
}
