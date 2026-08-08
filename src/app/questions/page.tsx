"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AiTag, Empty } from "@/components/ui";
import { deleteJSON, getJSON, patchJSON, postJSON } from "@/lib/client";
import {
  countHandoffBatch,
  handoffFilterReset,
  selectReviewQuestions,
} from "@/lib/question-handoff";

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
  answerChoices?: string | null;
  sourceExcerpt?: string | null;
  status?: "generated" | "edited" | "approved" | "rejected";
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
  // FastAPI-generated types
  active_recall: "Active recall",
  mcq: "Multiple choice",
  feynman: "Feynman / Self-explanation",
  fill_in_blank: "Fill in the blank",
  // Legacy mock-provider types (kept for existing rows)
  recall: "Active recall",
  practice: "Practice",
  cloze: "Fill in the blank",
};

const STATUS_LABEL: Record<"generated" | "edited" | "approved" | "rejected", string> = {
  generated: "Generated",
  edited: "Edited",
  approved: "Approved",
  rejected: "Rejected",
};

const FILTERS = ["all", "active_recall", "mcq", "feynman", "fill_in_blank", "recall", "cloze"];
const STATUS_FILTERS = ["all", "generated", "edited", "approved", "rejected"] as const;

export default function QuestionsPage() {
  return (
    <Suspense fallback={<div className="calibrate-question-bank">Loading Question Bank…</div>}>
      <QuestionsPageContent />
    </Suspense>
  );
}

function QuestionsPageContent() {
  const searchParams = useSearchParams();
  const urlSubjectId = searchParams.get("subjectId") ?? "";
  const urlMaterialId = searchParams.get("materialId") ?? "";
  const fromGenerate = searchParams.get("from") === "generate";
  // Re-run load whenever the generation handoff URL changes (including soft navigations).
  const handoffLoadKey = fromGenerate
    ? `generate:${urlSubjectId}:${urlMaterialId}`
    : `normal:${urlSubjectId}:${urlMaterialId}`;

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [subjectId, setSubjectId] = useState(urlSubjectId);
  const [filter, setFilter] = useState("all");
  const [materialFilter, setMaterialFilter] = useState(urlMaterialId || "all");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [highlightedMaterialId, setHighlightedMaterialId] = useState<string | null>(null);
  // Generation handoff only — never applied for ordinary sidebar visits.
  const [handoffMaterialId, setHandoffMaterialId] = useState<string | null>(
    fromGenerate && urlMaterialId ? urlMaterialId : null,
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [count, setCount] = useState(6);
  const [generating, setGenerating] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Material saved for a generation attempt that failed, so "Try again"
  // retries against it instead of saving the same notes a second time.
  const [pendingMaterialId, setPendingMaterialId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const scrolledHandoffRef = useRef(false);

  async function fetchQuestionBank(options?: { bustCache?: boolean }) {
    const listParams = new URLSearchParams();
    if (options?.bustCache) listParams.set("_ts", String(Date.now()));
    const suffix = listParams.size ? `?${listParams}` : "";
    const [subs, qs, mats] = await Promise.all([
      getJSON<Subject[]>("/api/subjects"),
      getJSON<Question[]>(`/api/questions${suffix}`),
      getJSON<Material[]>("/api/materials"),
    ]);
    return { subs, qs, mats };
  }

  async function refresh(options?: { preserveFilters?: boolean; bustCache?: boolean }) {
    const { subs, qs, mats } = await fetchQuestionBank({
      bustCache: options?.bustCache,
    });
    setSubjects(subs);
    setQuestions(qs);
    setMaterials(mats);
    if (!options?.preserveFilters) {
      setMaterialFilter((prev) => (prev === "all" || mats.some((m) => m.id === prev) ? prev : "all"));
      if (!subjectId && subs[0]) setSubjectId(subs[0].id);
    }
    setLoaded(true);
  }

  useEffect(() => {
    let cancelled = false;
    scrolledHandoffRef.current = false;

    async function loadFromUrl() {
      setLoaded(false);
      setLoadError(null);
      try {
        if (fromGenerate && urlMaterialId) {
          // Apply handoff filters immediately so an intermediate empty state cannot win.
          const provisionalSubject = urlSubjectId;
          const reset = handoffFilterReset(provisionalSubject, urlMaterialId);
          setFilter(reset.typeFilter);
          setStatusFilter(reset.statusFilter as (typeof STATUS_FILTERS)[number]);
          setMaterialFilter(reset.materialFilter);
          setHandoffMaterialId(reset.handoffMaterialId);
          if (provisionalSubject) setSubjectId(provisionalSubject);

          const { subs, qs, mats } = await fetchQuestionBank({ bustCache: true });
          if (cancelled) return;

          setSubjects(subs);
          setQuestions(qs);
          setMaterials(mats);

          const subject =
            (urlSubjectId && subs.find((item) => item.id === urlSubjectId)?.id) ||
            mats.find((item) => item.id === urlMaterialId)?.subjectId ||
            subs[0]?.id ||
            "";
          const applied = handoffFilterReset(subject, urlMaterialId);
          setSubjectId(applied.subjectId);
          setMaterialFilter(applied.materialFilter);
          setFilter(applied.typeFilter);
          setStatusFilter(applied.statusFilter as (typeof STATUS_FILTERS)[number]);
          setHandoffMaterialId(applied.handoffMaterialId);
          setLoaded(true);
          return;
        }

        // Ordinary Question Bank visit — no forced handoff banner/scroll.
        setHandoffMaterialId(null);
        const { subs, qs, mats } = await fetchQuestionBank({ bustCache: false });
        if (cancelled) return;
        setSubjects(subs);
        setQuestions(qs);
        setMaterials(mats);

        if (urlSubjectId && subs.some((subject) => subject.id === urlSubjectId)) {
          setSubjectId(urlSubjectId);
        } else if (subs[0]) {
          setSubjectId((current) => current || subs[0].id);
        }
        if (urlMaterialId && mats.some((material) => material.id === urlMaterialId)) {
          setMaterialFilter(urlMaterialId);
        }
        setLoaded(true);
      } catch (cause) {
        if (cancelled) return;
        setLoadError(cause instanceof Error ? cause.message : "We couldn’t load Question Bank.");
        setLoaded(true);
      }
    }

    void loadFromUrl();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoffLoadKey]);

  const materialTitleById = useMemo(
    () => Object.fromEntries(materials.map((m) => [m.id, m.title])),
    [materials],
  );

  const subjectMaterials = useMemo(() => {
    const list = subjectId
      ? materials.filter((material) => material.subjectId === subjectId)
      : [...materials];
    // Keep the handed-off material selectable even if subject state briefly lags.
    if (handoffMaterialId && !list.some((material) => material.id === handoffMaterialId)) {
      const handoffMaterial = materials.find((material) => material.id === handoffMaterialId);
      if (handoffMaterial) list.unshift(handoffMaterial);
    }
    return list;
  }, [materials, subjectId, handoffMaterialId]);

  const reviewQuestions = useMemo(
    () =>
      selectReviewQuestions(questions, {
        subjectId,
        materialFilter,
        typeFilter: filter,
        statusFilter,
        handoffMaterialId,
      }),
    [questions, subjectId, materialFilter, filter, statusFilter, handoffMaterialId],
  );

  const handoffBatchCount = countHandoffBatch(questions, handoffMaterialId);
  const handoffMaterialTitle = handoffMaterialId ? materialTitleById[handoffMaterialId] : null;

  useEffect(() => {
    if (!loaded || !handoffMaterialId || scrolledHandoffRef.current) return;
    if (handoffBatchCount === 0 || reviewQuestions.length === 0) return;
    scrolledHandoffRef.current = true;
    requestAnimationFrame(() => {
      document.getElementById("review-batch")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [loaded, handoffMaterialId, handoffBatchCount, reviewQuestions.length]);

  async function generate() {
    if (!subjectId || !content.trim()) return;

    setGenerating(true);
    setError(null);
    setProvider(null);
    setGeneratedCount(0);

    try {
      const subjectName = subjects.find((subject) => subject.id === subjectId)?.name;
      // A new submit saves a new material; a retry reuses the one already saved.
      const materialId =
        pendingMaterialId ??
        (
          await postJSON<{ id: string }>("/api/materials", {
            subjectId,
            title: title.trim() || "Untitled material",
            content,
          })
        ).id;
      setPendingMaterialId(materialId);

      const result = await postJSON<{ provider: string; questions: Question[] }>(
        "/api/questions/generate",
        { subjectId, subjectName, materialId, count },
      );

      const reset = handoffFilterReset(subjectId, materialId);
      setProvider(result.provider);
      setGeneratedCount(result.questions.length);
      setSubjectId(reset.subjectId);
      setMaterialFilter(reset.materialFilter);
      setFilter(reset.typeFilter);
      setStatusFilter(reset.statusFilter as (typeof STATUS_FILTERS)[number]);
      setHandoffMaterialId(reset.handoffMaterialId);
      scrolledHandoffRef.current = false;
      setPendingMaterialId(null);
      setTitle("");
      setContent("");
      await refresh({ preserveFilters: true, bustCache: true });
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

  function reviewGeneratedQuestions() {
    if (materialFilter !== "all") {
      const reset = handoffFilterReset(subjectId, materialFilter);
      setHandoffMaterialId(reset.handoffMaterialId);
      setMaterialFilter(reset.materialFilter);
      setFilter(reset.typeFilter);
      setStatusFilter(reset.statusFilter as (typeof STATUS_FILTERS)[number]);
      scrolledHandoffRef.current = false;
      return;
    }
    document
      .getElementById("question-review-summary")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function selectMaterialFilter(next: string) {
    setMaterialFilter(next);
    if (handoffMaterialId && next !== handoffMaterialId) {
      setHandoffMaterialId(null);
    }
  }

  const handoffSubjectName = subjects.find((subject) => subject.id === subjectId)?.name ?? null;

  const scopedReviewable = reviewQuestions.filter((question) =>
    ["generated", "edited"].includes(question.status ?? "approved"),
  );
  const scopedApproved = reviewQuestions.filter((question) => question.status === "approved");
  const handoffActive = Boolean(handoffMaterialId);
  const handoffLoading = handoffActive && !loaded;
  const handoffReady = handoffActive && loaded && handoffBatchCount > 0;
  const handoffEmpty = handoffActive && loaded && handoffBatchCount === 0;

  async function updateQuestion(id: string, body: Record<string, unknown>) {
    const updated = await patchJSON<Question>(`/api/questions/${id}`, body);
    setQuestions((previous) => previous.map((question) => (question.id === id ? updated : question)));
  }

  async function approveAllRemaining() {
    if (!subjectId) return;
    const result = await patchJSON<{ approved: number }>("/api/questions", {
      subjectId,
      materialId: materialFilter === "all" ? null : materialFilter,
    });
    if (result.approved) await refresh();
  }

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

  const addMaterialHref = subjectId
    ? `/subjects/${encodeURIComponent(subjectId)}/materials/new`
    : "/subjects";

  return (
    <div className="calibrate-question-bank animate-rise">
      <header className="calibrate-question-bank__header">
        <div className="calibrate-question-bank__header-row">
          <div>
            <p className="calibrate-question-bank__eyebrow">Question Bank</p>
            <h1>Review and approve questions before studying</h1>
            <p className="calibrate-question-bank__intro">
              Material → Generate → Review → Approve → Study. Subjects own materials; this page owns
              the review queue.
            </p>
          </div>
          {subjects.length > 0 && (
            <Link href={addMaterialHref} className="calibrate-question-bank__secondary">
              Add material
            </Link>
          )}
        </div>
      </header>

      {subjects.length === 0 ? (
        <div className="calibrate-empty-state">
          <p className="calibrate-empty-state__title">Add a subject first</p>
          <p>Question sets stay organized by the subject you&apos;re working on.</p>
          <Link href="/subjects" className="calibrate-question-bank__button">
            Add a subject
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
                  onChange={(event) => {
                    const nextSubject = event.target.value;
                    setSubjectId(nextSubject);
                    setMaterialFilter("all");
                    setHandoffMaterialId(null);
                    setHighlightedMaterialId(null);
                  }}
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
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setPendingMaterialId(null);
                  }}
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
                  onChange={(event) => {
                    setContent(event.target.value);
                    setPendingMaterialId(null);
                  }}
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

          {error && (
            <div className="calibrate-generator__error" role="alert">
              <p>{error}</p>
              <button
                type="button"
                className="calibrate-question-bank__button"
                onClick={() => void generate()}
                disabled={generating || !content.trim()}
              >
                Try again
              </button>
            </div>
          )}
          {generatedCount > 0 && !generating && !error && (
            <div className="calibrate-generator__notice" role="status">
              <p>
                <strong>Questions ready</strong> — {generatedCount} question
                {generatedCount === 1 ? "" : "s"} waiting for your review.
              </p>
              <button
                type="button"
                className="calibrate-question-bank__button"
                onClick={reviewGeneratedQuestions}
              >
                Review questions
              </button>
            </div>
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
              const linkedCount = questions.filter((q) => q.materialId === mat.id).length;
              const isHighlighted = highlightedMaterialId === mat.id;
              return (
                <article
                  key={mat.id}
                  className={`calibrate-question-card${isHighlighted ? " is-highlighted" : ""}`}
                  onClick={() =>
                    setHighlightedMaterialId((prev) => (prev === mat.id ? null : mat.id))
                  }
                  style={{ cursor: "pointer" }}
                >
                  <div className="calibrate-question-card__meta">
                    <span>{subject?.name ?? "Unknown subject"}</span>
                    <span>{new Date(mat.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="calibrate-question-card__prompt">{mat.title}</p>
                  <div className="calibrate-question-card__meta" style={{ marginTop: "0.25rem" }}>
                    <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>
                      {linkedCount} question{linkedCount === 1 ? "" : "s"}
                      {linkedCount > 0 ? " — click to highlight" : ""}
                    </span>
                  </div>
                  <div className="calibrate-question-card__actions">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteMaterial(mat.id, mat.title);
                      }}
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
            <p className="calibrate-question-bank__eyebrow">Review queue</p>
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
            {subjectMaterials.length > 0 && (
              <select
                aria-label="Filter by material"
                value={materialFilter}
                onChange={(e) => selectMaterialFilter(e.target.value)}
                className="calibrate-question-filters__material-select"
              >
                <option value="all">All materials</option>
                {subjectMaterials.map((mat) => (
                  <option key={mat.id} value={mat.id}>
                    {mat.title}
                  </option>
                ))}
              </select>
            )}
              <select
                aria-label="Filter by review status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="calibrate-question-filters__material-select"
              >
                {STATUS_FILTERS.map((status) => (
                  <option key={status} value={status}>
                    {status === "all" ? "All review states" : STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
          </div>
        </div>

          {handoffLoading && (
            <div id="review-batch" className="calibrate-review-batch" role="status" aria-live="polite">
              <p className="calibrate-question-bank__eyebrow">Ready for review</p>
              <h3>Loading your generated questions…</h3>
              <p>Fetching the new batch for this material.</p>
            </div>
          )}

          {handoffReady && (
            <div
              id="review-batch"
              className="calibrate-review-batch"
              aria-labelledby="review-batch-title"
            >
              <div className="calibrate-review-batch__top">
                <p className="calibrate-question-bank__eyebrow">Ready for review</p>
                <span className="calibrate-review-batch__badge">Just generated</span>
              </div>
              <h3 id="review-batch-title">
                {handoffBatchCount} question{handoffBatchCount === 1 ? "" : "s"} generated from{" "}
                {handoffMaterialTitle ?? "your material"}
              </h3>
              <p>
                {handoffSubjectName ? `${handoffSubjectName} · ` : ""}
                Review each question before it can be used in Study. Status stays Generated until you
                edit, approve, or reject.
              </p>
            </div>
          )}

          {handoffEmpty && (
            <div id="review-batch" className="calibrate-review-batch" role="alert">
              <p className="calibrate-question-bank__eyebrow">Ready for review</p>
              <h3>We couldn’t find questions for this material yet</h3>
              <p>
                Generation finished, but Question Bank has no persisted rows for this material. Try
                generating again from Add material.
              </p>
            </div>
          )}

          <div className="calibrate-question-review-summary" id="question-review-summary">
            <p>
              Review generated questions before studying. {scopedApproved.length} approved in this view.
            </p>
            {scopedReviewable.length > 0 && (
              <button type="button" className="calibrate-question-bank__button" onClick={() => void approveAllRemaining()}>
                Approve all remaining ({scopedReviewable.length})
              </button>
            )}
            {scopedApproved.length > 0 && (
              <Link
                className="calibrate-question-bank__button calibrate-question-bank__button--study"
                href={`/study?subjectId=${encodeURIComponent(subjectId)}${materialFilter !== "all" ? `&materialId=${encodeURIComponent(materialFilter)}` : ""}`}
              >
                Study approved questions
              </Link>
            )}
          </div>

        {loadError ? (
          <Empty title="We couldn’t load Question Bank">{loadError}</Empty>
        ) : !loaded ? (
          <Empty title="Loading questions…">Fetching your review queue.</Empty>
        ) : reviewQuestions.length === 0 ? (
          <Empty
            title={
              handoffEmpty
                ? "No persisted questions for this material"
                : questions.some((question) => !subjectId || question.subjectId === subjectId)
                  ? "No questions match this filter"
                  : statusFilter === "approved"
                    ? "No approved questions yet"
                    : statusFilter === "generated" || statusFilter === "edited"
                      ? "No questions waiting for review"
                      : "No questions yet"
            }
          >
            {handoffEmpty ? (
              "Go back to Add material and generate again."
            ) : questions.some((question) => !subjectId || question.subjectId === subjectId) ? (
              "Try another status, type, or material filter."
            ) : (
              <>
                Paste notes above, or{" "}
                <Link href={addMaterialHref} className="font-medium text-brand hover:underline">
                  Add material
                </Link>{" "}
                to generate questions for this subject.
              </>
            )}
          </Empty>
        ) : (
          <div className="calibrate-question-list">
            {reviewQuestions.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                materialTitle={question.materialId ? materialTitleById[question.materialId] : undefined}
                subjectName={subjects.find((subject) => subject.id === question.subjectId)?.name}
                highlighted={
                  !!question.materialId &&
                  (question.materialId === handoffMaterialId ||
                    question.materialId === highlightedMaterialId)
                }
                onDelete={deleteQuestion}
                onUpdate={updateQuestion}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function QuestionCard({
  question,
  materialTitle,
  subjectName,
  highlighted,
  onDelete,
  onUpdate,
}: {
  question: Question;
  materialTitle?: string;
  subjectName?: string;
  highlighted?: boolean;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, body: Record<string, unknown>) => Promise<void>;
}) {
  const [revealed, setRevealed] = useState(false);
  const [sourceVisible, setSourceVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [practicing, setPracticing] = useState(false);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(question.prompt);
  const [draftAnswer, setDraftAnswer] = useState(question.answer);
  const [draftChoices, setDraftChoices] = useState(() => parseChoices(question.answerChoices));

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

  async function update(action: "approve" | "reject" | "edit") {
    setSaving(true);
    try {
      await onUpdate(
        question.id,
        action === "edit"
          ? {
              action,
              prompt: draftPrompt,
              answer: draftAnswer,
              answerChoices: question.type === "mcq" ? draftChoices : [],
            }
          : { action },
      );
      if (action === "edit") setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className={`calibrate-question-card${highlighted ? " is-highlighted" : ""}`}>
      <div className="calibrate-question-card__meta">
        <span>{TYPE_LABEL[question.type] ?? question.type}</span>
        <span className={`calibrate-question-status is-${question.status ?? "approved"}`}>
          {question.status === "approved"
            ? "✓ Approved"
            : STATUS_LABEL[question.status ?? "generated"]}
        </span>
        <span className="calibrate-question-card__context">{subjectName ?? "Unknown subject"}</span>
        {materialTitle && (
          <span className="calibrate-question-card__context calibrate-question-card__material-tag" title="Source material">
            {materialTitle}
          </span>
        )}
      </div>
      {editing ? (
        <div className="calibrate-question-card__practice">
          <label className="calibrate-question-bank__label">Question</label>
          <textarea value={draftPrompt} onChange={(event) => setDraftPrompt(event.target.value)} rows={3} className="calibrate-question-bank__field calibrate-question-bank__textarea" />
          <label className="calibrate-question-bank__label">Answer</label>
          <textarea value={draftAnswer} onChange={(event) => setDraftAnswer(event.target.value)} rows={2} className="calibrate-question-bank__field calibrate-question-bank__textarea" />
          {question.type === "mcq" && draftChoices.map((choice, index) => (
            <input key={index} value={choice} onChange={(event) => setDraftChoices((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className="calibrate-question-bank__field" aria-label={`Answer choice ${index + 1}`} />
          ))}
          <div className="calibrate-question-card__actions">
            <button type="button" onClick={() => void update("edit")} disabled={saving}>Save edit</button>
            <button type="button" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : <p className="calibrate-question-card__prompt">{question.prompt}</p>}

      <div className="calibrate-question-card__actions">
        <button type="button" onClick={() => setRevealed((isRevealed) => !isRevealed)}>
          {revealed ? "Hide answer" : "Show answer"}
        </button>
        {question.sourceExcerpt && <button type="button" onClick={() => setSourceVisible((visible) => !visible)}>{sourceVisible ? "Hide supporting notes" : "View supporting notes"}</button>}
        {question.status !== "approved" && question.status !== "rejected" && <button type="button" onClick={() => setEditing(true)}>Edit</button>}
        {question.status !== "approved" && question.status !== "rejected" && <button type="button" onClick={() => void update("approve")} disabled={saving}>Approve</button>}
        {question.status !== "rejected" && <button type="button" onClick={() => void update("reject")} disabled={saving}>Reject</button>}
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
        <div className="calibrate-question-card__answer">
          <strong>Answer</strong>
          <p>{question.answer}</p>
          {question.type === "mcq" && <ul>{parseChoices(question.answerChoices).map((choice) => <li key={choice}><span>{choice === question.answer ? "✓ " : ""}</span>{choice}</li>)}</ul>}
        </div>
      )}
      {sourceVisible && question.sourceExcerpt && <div className="calibrate-question-card__answer"><strong>Supporting notes</strong><p>{question.sourceExcerpt}</p></div>}

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

function parseChoices(value?: string | null) {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
