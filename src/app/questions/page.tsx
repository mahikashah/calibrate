"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { QuestionCountControl } from "@/components/QuestionCountControl";
import { AiTag, Empty } from "@/components/ui";
import { deleteJSON, getJSON, patchJSON, postJSON } from "@/lib/client";
import {
  QUESTION_BANK_PAGE_SIZE,
  filterBankQuestions,
  filtersAreDefault,
  paginateItems,
} from "@/lib/question-bank-list";
import {
  QUESTION_COUNT_DEFAULT,
  shortfallCopy,
} from "@/lib/question-count";
import {
  countHandoffBatch,
  handoffFilterReset,
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
  active_recall: "Active recall",
  mcq: "Multiple choice",
  feynman: "Feynman / Self-explanation",
  fill_in_blank: "Fill in the blank",
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

const TYPE_FILTERS = ["all", "active_recall", "mcq", "feynman", "fill_in_blank"] as const;
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
  const handoffLoadKey = fromGenerate
    ? `generate:${urlSubjectId}:${urlMaterialId}`
    : `normal:${urlSubjectId}:${urlMaterialId}`;

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  // Generator subject (always a concrete subject when subjects exist).
  const [generateSubjectId, setGenerateSubjectId] = useState(urlSubjectId);
  // Saved Questions filters — default All subjects on normal visits.
  const [subjectFilter, setSubjectFilter] = useState(fromGenerate && urlSubjectId ? urlSubjectId : "all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [materialFilter, setMaterialFilter] = useState(urlMaterialId || "all");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [page, setPage] = useState(1);
  const [highlightedMaterialId, setHighlightedMaterialId] = useState<string | null>(null);
  const [handoffMaterialId, setHandoffMaterialId] = useState<string | null>(
    fromGenerate && urlMaterialId ? urlMaterialId : null,
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [count, setCount] = useState(QUESTION_COUNT_DEFAULT);
  const [generating, setGenerating] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [requestedCount, setRequestedCount] = useState(QUESTION_COUNT_DEFAULT);
  const [error, setError] = useState<string | null>(null);
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
      if (!generateSubjectId && subs[0]) setGenerateSubjectId(subs[0].id);
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
          const provisionalSubject = urlSubjectId;
          const reset = handoffFilterReset(provisionalSubject, urlMaterialId);
          setTypeFilter(reset.typeFilter);
          setStatusFilter(reset.statusFilter as (typeof STATUS_FILTERS)[number]);
          setMaterialFilter(reset.materialFilter);
          setHandoffMaterialId(reset.handoffMaterialId);
          setPage(1);
          if (provisionalSubject) {
            setSubjectFilter(provisionalSubject);
            setGenerateSubjectId(provisionalSubject);
          }

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
          setSubjectFilter(applied.subjectId);
          setGenerateSubjectId(applied.subjectId || subs[0]?.id || "");
          setMaterialFilter(applied.materialFilter);
          setTypeFilter(applied.typeFilter);
          setStatusFilter(applied.statusFilter as (typeof STATUS_FILTERS)[number]);
          setHandoffMaterialId(applied.handoffMaterialId);
          setPage(1);
          setLoaded(true);
          return;
        }

        setHandoffMaterialId(null);
        const { subs, qs, mats } = await fetchQuestionBank({ bustCache: false });
        if (cancelled) return;
        setSubjects(subs);
        setQuestions(qs);
        setMaterials(mats);

        if (urlSubjectId && subs.some((subject) => subject.id === urlSubjectId)) {
          setSubjectFilter(urlSubjectId);
          setGenerateSubjectId(urlSubjectId);
        } else {
          setSubjectFilter("all");
          if (subs[0]) setGenerateSubjectId((current) => current || subs[0].id);
        }
        if (urlMaterialId && mats.some((material) => material.id === urlMaterialId)) {
          setMaterialFilter(urlMaterialId);
        } else {
          setMaterialFilter("all");
        }
        setPage(1);
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

  const filterMaterials = useMemo(() => {
    if (subjectFilter === "all") return [] as Material[];
    const list = materials.filter((material) => material.subjectId === subjectFilter);
    if (handoffMaterialId && !list.some((material) => material.id === handoffMaterialId)) {
      const handoffMaterial = materials.find((material) => material.id === handoffMaterialId);
      if (handoffMaterial) list.unshift(handoffMaterial);
    }
    return list;
  }, [materials, subjectFilter, handoffMaterialId]);

  const visibleMaterials = useMemo(() => {
    if (subjectFilter === "all") return materials;
    return materials.filter((material) => material.subjectId === subjectFilter);
  }, [materials, subjectFilter]);

  const reviewQuestions = useMemo(
    () =>
      filterBankQuestions(questions, {
        subjectFilter,
        materialFilter,
        typeFilter,
        statusFilter,
        handoffMaterialId,
      }),
    [questions, subjectFilter, materialFilter, typeFilter, statusFilter, handoffMaterialId],
  );

  const pageSlice = useMemo(
    () => paginateItems(reviewQuestions, page, QUESTION_BANK_PAGE_SIZE),
    [reviewQuestions, page],
  );

  // Keep page in range when the filtered set shrinks.
  useEffect(() => {
    if (page !== pageSlice.page) setPage(pageSlice.page);
  }, [page, pageSlice.page]);

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

  function resetPage() {
    setPage(1);
  }

  function changeSubjectFilter(next: string) {
    setSubjectFilter(next);
    setMaterialFilter("all");
    setHighlightedMaterialId(null);
    if (handoffMaterialId) setHandoffMaterialId(null);
    resetPage();
  }

  function changeMaterialFilter(next: string) {
    setMaterialFilter(next);
    if (handoffMaterialId && next !== handoffMaterialId) setHandoffMaterialId(null);
    if (next !== "all") {
      const mat = materials.find((item) => item.id === next);
      if (mat) setSubjectFilter(mat.subjectId);
    }
    resetPage();
  }

  function changeTypeFilter(next: string) {
    setTypeFilter(next);
    if (handoffMaterialId) setHandoffMaterialId(null);
    resetPage();
  }

  function changeStatusFilter(next: (typeof STATUS_FILTERS)[number]) {
    setStatusFilter(next);
    if (handoffMaterialId) setHandoffMaterialId(null);
    resetPage();
  }

  function clearFilters() {
    setSubjectFilter("all");
    setMaterialFilter("all");
    setTypeFilter("all");
    setStatusFilter("all");
    setHandoffMaterialId(null);
    setHighlightedMaterialId(null);
    setPage(1);
  }

  function selectMaterialCard(mat: Material) {
    setSubjectFilter(mat.subjectId);
    setMaterialFilter(mat.id);
    setHighlightedMaterialId(mat.id);
    setHandoffMaterialId(null);
    setPage(1);
  }

  async function generate() {
    if (!generateSubjectId || !content.trim()) return;

    setGenerating(true);
    setError(null);
    setProvider(null);
    setGeneratedCount(0);
    setRequestedCount(count);

    try {
      const subjectName = subjects.find((subject) => subject.id === generateSubjectId)?.name;
      const materialId =
        pendingMaterialId ??
        (
          await postJSON<{ id: string }>("/api/materials", {
            subjectId: generateSubjectId,
            title: title.trim() || "Untitled material",
            content,
          })
        ).id;
      setPendingMaterialId(materialId);

      const result = await postJSON<{
        provider: string;
        questions: Question[];
        questionCount?: number;
      }>("/api/questions/generate", {
        subjectId: generateSubjectId,
        subjectName,
        materialId,
        count,
      });

      const actual = result.questionCount ?? result.questions.length;
      const reset = handoffFilterReset(generateSubjectId, materialId);
      setProvider(result.provider);
      setGeneratedCount(actual);
      setSubjectFilter(reset.subjectId);
      setMaterialFilter(reset.materialFilter);
      setTypeFilter(reset.typeFilter);
      setStatusFilter(reset.statusFilter as (typeof STATUS_FILTERS)[number]);
      setHandoffMaterialId(reset.handoffMaterialId);
      setPage(1);
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
      const reset = handoffFilterReset(
        subjectFilter !== "all" ? subjectFilter : generateSubjectId,
        materialFilter,
      );
      setHandoffMaterialId(reset.handoffMaterialId);
      setSubjectFilter(reset.subjectId);
      setMaterialFilter(reset.materialFilter);
      setTypeFilter(reset.typeFilter);
      setStatusFilter(reset.statusFilter as (typeof STATUS_FILTERS)[number]);
      setPage(1);
      scrolledHandoffRef.current = false;
      return;
    }
    document
      .getElementById("question-review-summary")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const handoffSubjectName =
    subjects.find((subject) => subject.id === (subjectFilter !== "all" ? subjectFilter : generateSubjectId))
      ?.name ?? null;

  const scopedReviewable = reviewQuestions.filter((question) =>
    ["generated", "edited"].includes(question.status ?? "approved"),
  );
  const scopedApproved = reviewQuestions.filter((question) => question.status === "approved");
  const handoffActive = Boolean(handoffMaterialId);
  const handoffLoading = handoffActive && !loaded;
  const handoffReady = handoffActive && loaded && handoffBatchCount > 0;
  const handoffEmpty = handoffActive && loaded && handoffBatchCount === 0;
  const filtersActive = !filtersAreDefault({
    subjectFilter,
    materialFilter,
    typeFilter,
    statusFilter,
  });
  const generationShortfall = shortfallCopy(requestedCount, generatedCount);

  const studySubjectId =
    subjectFilter !== "all"
      ? subjectFilter
      : materials.find((item) => item.id === materialFilter)?.subjectId ?? "";

  async function updateQuestion(id: string, body: Record<string, unknown>) {
    const updated = await patchJSON<Question>(`/api/questions/${id}`, body);
    setQuestions((previous) => previous.map((question) => (question.id === id ? updated : question)));
  }

  async function approveAllRemaining() {
    // Approve only questions matching the current filtered view (not the whole bank).
    for (const question of scopedReviewable) {
      await patchJSON(`/api/questions/${question.id}`, { action: "approve" });
    }
    await refresh({ preserveFilters: true });
  }

  async function deleteMaterial(id: string, matTitle: string) {
    const linkedCount = questions.filter((q) => q.materialId === id).length;
    const confirmMsg =
      linkedCount > 0
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

  const addMaterialHref = generateSubjectId
    ? `/subjects/${encodeURIComponent(generateSubjectId)}/materials/new`
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
                  value={generateSubjectId}
                  onChange={(event) => setGenerateSubjectId(event.target.value)}
                  className="calibrate-question-bank__field"
                >
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>

              <QuestionCountControl
                value={count}
                onChange={setCount}
                id="question-count"
                label="Number of questions"
              />
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
              {generationShortfall && <p>{generationShortfall}</p>}
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

      {visibleMaterials.length > 0 && (
        <section className="calibrate-saved-questions" aria-labelledby="saved-materials-title">
          <div className="calibrate-saved-questions__heading">
            <div>
              <p className="calibrate-question-bank__eyebrow">Your library</p>
              <h2 id="saved-materials-title">
                Saved materials <span>{visibleMaterials.length}</span>
              </h2>
            </div>
          </div>
          <div className="calibrate-question-list">
            {visibleMaterials.map((mat) => {
              const subject = subjects.find((s) => s.id === mat.subjectId);
              const linkedCount = questions.filter((q) => q.materialId === mat.id).length;
              const isHighlighted =
                highlightedMaterialId === mat.id || materialFilter === mat.id;
              return (
                <article
                  key={mat.id}
                  className={`calibrate-question-card${isHighlighted ? " is-highlighted" : ""}`}
                  onClick={() => selectMaterialCard(mat)}
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
                      {linkedCount > 0 ? " — click to filter" : ""}
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
              Saved questions <span>{questions.length} total</span>
            </h2>
            {loaded && questions.length > 0 && (
              <p className="calibrate-question-bank__count-line">
                {reviewQuestions.length === questions.length
                  ? `Showing ${pageSlice.from}–${pageSlice.to} of ${pageSlice.total}`
                  : `${reviewQuestions.length} match your filters · Showing ${pageSlice.from}–${pageSlice.to}`}
              </p>
            )}
          </div>
        </div>

        <div className="calibrate-question-filter-bar" aria-label="Filter saved questions">
          <div className="calibrate-question-filter-field">
            <label htmlFor="filter-subject">Subject</label>
            <select
              id="filter-subject"
              value={subjectFilter}
              onChange={(event) => changeSubjectFilter(event.target.value)}
              className="calibrate-question-filters__material-select"
            >
              <option value="all">All subjects</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>

          <div className="calibrate-question-filter-field">
            <label htmlFor="filter-material">Material</label>
            <select
              id="filter-material"
              value={subjectFilter === "all" ? "all" : materialFilter}
              onChange={(event) => changeMaterialFilter(event.target.value)}
              className="calibrate-question-filters__material-select"
              disabled={subjectFilter === "all"}
            >
              <option value="all">All materials</option>
              {subjectFilter !== "all" &&
                filterMaterials.map((mat) => (
                  <option key={mat.id} value={mat.id}>
                    {mat.title}
                  </option>
                ))}
            </select>
          </div>

          <div className="calibrate-question-filter-field">
            <label htmlFor="filter-type">Question type</label>
            <select
              id="filter-type"
              value={typeFilter}
              onChange={(event) => changeTypeFilter(event.target.value)}
              className="calibrate-question-filters__material-select"
            >
              {TYPE_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {value === "all" ? "All" : TYPE_LABEL[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="calibrate-question-filter-field">
            <label htmlFor="filter-status">Review state</label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(event) =>
                changeStatusFilter(event.target.value as (typeof STATUS_FILTERS)[number])
              }
              className="calibrate-question-filters__material-select"
            >
              {STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {status === "all" ? "All review states" : STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </div>

          {filtersActive && (
            <div className="calibrate-question-filter-field calibrate-question-filter-field--action">
              <button type="button" className="calibrate-question-bank__secondary" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          )}
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
            Review generated questions before studying. {scopedApproved.length} approved in this
            view.
          </p>
          {scopedReviewable.length > 0 && (
            <button
              type="button"
              className="calibrate-question-bank__button"
              onClick={() => void approveAllRemaining()}
            >
              Approve all generated in this view ({scopedReviewable.length})
            </button>
          )}
          {scopedApproved.length > 0 && studySubjectId && (
            <Link
              className="calibrate-question-bank__button calibrate-question-bank__button--study"
              href={`/study?subjectId=${encodeURIComponent(studySubjectId)}${
                materialFilter !== "all" ? `&materialId=${encodeURIComponent(materialFilter)}` : ""
              }`}
            >
              Study approved questions
            </Link>
          )}
        </div>

        {loadError ? (
          <Empty title="We couldn’t load Question Bank">{loadError}</Empty>
        ) : !loaded ? (
          <Empty title="Loading questions…">Fetching your review queue.</Empty>
        ) : questions.length === 0 ? (
          <Empty title="No questions yet">
            Paste notes above, or{" "}
            <Link href={addMaterialHref} className="font-medium text-brand hover:underline">
              Add material
            </Link>{" "}
            to generate questions.
          </Empty>
        ) : reviewQuestions.length === 0 ? (
          <Empty title="No questions match these filters.">
            {handoffEmpty ? (
              "Go back to Add material and generate again."
            ) : (
              <button type="button" className="calibrate-question-bank__button" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </Empty>
        ) : (
          <>
            <div className="calibrate-question-list">
              {pageSlice.items.map((question) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  materialTitle={
                    question.materialId ? materialTitleById[question.materialId] : undefined
                  }
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

            {pageSlice.totalPages > 1 && (
              <nav className="calibrate-question-pagination" aria-label="Question pages">
                <p className="calibrate-question-pagination__summary">
                  Showing {pageSlice.from}–{pageSlice.to} of {pageSlice.total}
                </p>
                <div className="calibrate-question-pagination__controls">
                  <button
                    type="button"
                    className="calibrate-question-bank__secondary"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={pageSlice.page <= 1}
                    aria-label="Previous page"
                  >
                    ← Previous
                  </button>
                  <span aria-current="page">
                    Page {pageSlice.page} of {pageSlice.totalPages}
                  </span>
                  <button
                    type="button"
                    className="calibrate-question-bank__secondary"
                    onClick={() =>
                      setPage((current) => Math.min(pageSlice.totalPages, current + 1))
                    }
                    disabled={pageSlice.page >= pageSlice.totalPages}
                    aria-label="Next page"
                  >
                    Next →
                  </button>
                </div>
              </nav>
            )}
          </>
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
          <span
            className="calibrate-question-card__context calibrate-question-card__material-tag"
            title="Source material"
          >
            {materialTitle}
          </span>
        )}
      </div>
      {editing ? (
        <div className="calibrate-question-card__practice">
          <label className="calibrate-question-bank__label">Question</label>
          <textarea
            value={draftPrompt}
            onChange={(event) => setDraftPrompt(event.target.value)}
            rows={3}
            className="calibrate-question-bank__field calibrate-question-bank__textarea"
          />
          <label className="calibrate-question-bank__label">Answer</label>
          <textarea
            value={draftAnswer}
            onChange={(event) => setDraftAnswer(event.target.value)}
            rows={2}
            className="calibrate-question-bank__field calibrate-question-bank__textarea"
          />
          {question.type === "mcq" &&
            draftChoices.map((choice, index) => (
              <input
                key={index}
                value={choice}
                onChange={(event) =>
                  setDraftChoices((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? event.target.value : item,
                    ),
                  )
                }
                className="calibrate-question-bank__field"
                aria-label={`Answer choice ${index + 1}`}
              />
            ))}
          <div className="calibrate-question-card__actions">
            <button type="button" onClick={() => void update("edit")} disabled={saving}>
              Save edit
            </button>
            <button type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="calibrate-question-card__prompt">{question.prompt}</p>
      )}

      <div className="calibrate-question-card__actions">
        <button type="button" onClick={() => setRevealed((isRevealed) => !isRevealed)}>
          {revealed ? "Hide answer" : "Show answer"}
        </button>
        {question.sourceExcerpt && (
          <button type="button" onClick={() => setSourceVisible((visible) => !visible)}>
            {sourceVisible ? "Hide supporting notes" : "View supporting notes"}
          </button>
        )}
        {question.status !== "approved" && question.status !== "rejected" && (
          <button type="button" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
        {question.status !== "approved" && question.status !== "rejected" && (
          <button type="button" onClick={() => void update("approve")} disabled={saving}>
            Approve
          </button>
        )}
        {question.status !== "rejected" && (
          <button type="button" onClick={() => void update("reject")} disabled={saving}>
            Reject
          </button>
        )}
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
          {question.type === "mcq" && (
            <ul>
              {parseChoices(question.answerChoices).map((choice) => (
                <li key={choice}>
                  <span>{choice === question.answer ? "✓ " : ""}</span>
                  {choice}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {sourceVisible && question.sourceExcerpt && (
        <div className="calibrate-question-card__answer">
          <strong>Supporting notes</strong>
          <p>{question.sourceExcerpt}</p>
        </div>
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

function parseChoices(value?: string | null) {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
