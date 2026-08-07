"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useState } from "react";
import { getJSON, postJSON } from "@/lib/client";

interface Subject {
  id: string;
  name: string;
  color: string;
}

type Source = "pdf" | "notes";

export default function AddMaterialPage() {
  const params = useParams<{ subjectId: string }>();
  const router = useRouter();
  const subjectId = params.subjectId;
  const [subject, setSubject] = useState<Subject | null>(null);
  const [source, setSource] = useState<Source>("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  // unified generating state covers both save+generate (notes) and parse+generate (pdf)
  const [generating, setGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [error, setError] = useState("");

  const isDone = generatedCount > 0;

  useEffect(() => {
    async function loadSubject() {
      try {
        const subjects = await getJSON<Subject[]>("/api/subjects");
        const matchingSubject = subjects.find((item) => item.id === subjectId) ?? null;
        setSubject(matchingSubject);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    loadSubject();
  }, [subjectId]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    if (selected && selected.type !== "application/pdf") {
      setError("Please select a PDF file.");
      event.target.value = "";
      return;
    }
    setError("");
    setFile(selected);
  }

  async function generateFromPdf() {
    if (!file) return;
    setGenerating(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("subjectId", subjectId);
      form.append("title", file.name.replace(/\.pdf$/i, ""));
      form.append("count", "6");

      const res = await fetch("/api/pdf", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Something went wrong. Please try again.");
      }
      const result = await res.json() as { questionCount: number };
      setGeneratedCount(result.questionCount);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function generateFromNotes() {
    if (!title.trim() || !content.trim()) return;
    setGenerating(true);
    setError("");
    try {
      // Step 1 — save material
      const material = await postJSON<{ id: string }>("/api/materials", {
        subjectId,
        title: title.trim(),
        content,
      });

      // Step 2 — generate questions linked to that material
      const result = await postJSON<{ questionCount?: number; questions?: unknown[] }>(
        "/api/questions/generate",
        { subjectId, materialId: material.id, count: 6 },
      );
      const count = result.questionCount ?? (result.questions as unknown[])?.length ?? 0;
      setGeneratedCount(count);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  if (loading)
    return (
      <div className="calibrate-material-page">
        <p className="text-muted">Loading subject…</p>
      </div>
    );

  if (!subject) {
    return (
      <div className="calibrate-material-page">
        <section className="calibrate-material-card text-center">
          <p className="label mb-3">Subject unavailable</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            We couldn&apos;t find that subject.
          </h1>
          <Link href="/subjects" className="btn-primary mt-6">
            Back to subjects
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="calibrate-material-page animate-rise">
      <section className="calibrate-material-card">
        <Link href="/subjects" className="calibrate-material-back">
          ← Subjects
        </Link>
        <p className="calibrate-material-eyebrow">Study material</p>
        <p className="calibrate-material-subject">
          <span style={{ background: subject.color }} aria-hidden="true" />
          Subject: {subject.name}
        </p>
        <h1>Add study material</h1>
        <p className="calibrate-material-intro">
          Use notes from the class you&apos;re actually studying.
        </p>

        {isDone ? (
          /* ── Success state ──────────────────────────────────────────── */
          <div className="calibrate-material-success" role="status">
            <p className="label">Questions ready</p>
            <h2>{generatedCount} question{generatedCount === 1 ? "" : "s"} generated</h2>
            <p>
              Review, approve, or edit them in your Question Bank before using them in a study
              session.
            </p>
            <div className="calibrate-material-actions">
              <Link href="/questions" className="calibrate-button calibrate-button-teal">
                Go to Question Bank
              </Link>
              <button
                type="button"
                className="calibrate-button calibrate-button-outline"
                onClick={() => {
                  setGeneratedCount(0);
                  setFile(null);
                  setTitle("");
                  setContent("");
                  setError("");
                }}
              >
                Add another material
              </button>
            </div>
          </div>
        ) : generating ? (
          /* ── Generating state ───────────────────────────────────────── */
          <div className="calibrate-material-success" role="status" aria-live="polite">
            <p className="label">Working…</p>
            <h2>Generating questions from your material…</h2>
            <p>This may take a few moments.</p>
          </div>
        ) : (
          /* ── Form state ─────────────────────────────────────────────── */
          <>
            <div
              className="calibrate-material-sources"
              role="tablist"
              aria-label="Choose material source"
            >
              <button
                type="button"
                role="tab"
                aria-selected={source === "pdf"}
                className={source === "pdf" ? "is-selected" : ""}
                onClick={() => setSource("pdf")}
              >
                <span>1</span> Upload PDF <small>Recommended</small>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={source === "notes"}
                className={source === "notes" ? "is-selected" : ""}
                onClick={() => setSource("notes")}
              >
                <span>2</span> Paste notes
              </button>
            </div>

            {source === "pdf" ? (
              /* ── PDF tab ──────────────────────────────────────────── */
              <div className="calibrate-upload-panel" role="tabpanel">
                <p className="label">Upload PDF</p>
                <h2>Choose a class PDF to generate questions from.</h2>
                <p>Text-based PDFs only. Scanned or image PDFs are not supported.</p>
                <label className="calibrate-upload-dropzone">
                  <input type="file" accept="application/pdf,.pdf" onChange={chooseFile} />
                  <span className="calibrate-upload-icon" aria-hidden="true">
                    ↑
                  </span>
                  <strong>{file ? file.name : "Select a PDF"}</strong>
                  <small>
                    {file
                      ? "PDF selected. Click below to generate questions."
                      : "PDF files only. You can replace it before uploading."}
                  </small>
                </label>
                {file && (
                  <button
                    type="button"
                    className="calibrate-upload-remove"
                    onClick={() => setFile(null)}
                  >
                    Remove selected file
                  </button>
                )}
                {file && (
                  <button
                    type="button"
                    className="calibrate-button calibrate-button-teal"
                    onClick={() => void generateFromPdf()}
                    disabled={generating}
                  >
                    Upload &amp; generate questions
                  </button>
                )}
              </div>
            ) : (
              /* ── Notes tab ────────────────────────────────────────── */
              <div className="calibrate-notes-panel" role="tabpanel">
                <div>
                  <label htmlFor="material-title" className="calibrate-material-field-label">
                    Material title
                  </label>
                  <input
                    id="material-title"
                    className="field"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Chapter 5 Lecture Notes"
                  />
                </div>
                <div>
                  <label htmlFor="material-content" className="calibrate-material-field-label">
                    Notes
                  </label>
                  <textarea
                    id="material-content"
                    className="field min-h-56 resize-y"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="Paste notes from one lecture, chapter, or study section…"
                  />
                  <p className="calibrate-material-helper">
                    Keep this to one lecture, chapter, or study section at a time (under 4,600
                    words).
                  </p>
                </div>
                <button
                  type="button"
                  className="calibrate-button calibrate-button-teal self-start"
                  onClick={() => void generateFromNotes()}
                  disabled={generating || !title.trim() || !content.trim()}
                >
                  Save &amp; generate questions
                </button>
              </div>
            )}

            {error && (
              <p className="calibrate-form-error mt-4" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
