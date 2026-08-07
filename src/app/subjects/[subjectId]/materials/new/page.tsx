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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

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

  async function saveNotes() {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    setError("");
    try {
      await postJSON("/api/materials", { subjectId, title: title.trim(), content });
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="calibrate-material-page"><p className="text-muted">Loading subject…</p></div>;

  if (!subject) {
    return (
      <div className="calibrate-material-page">
        <section className="calibrate-material-card text-center">
          <p className="label mb-3">Subject unavailable</p>
          <h1 className="text-2xl font-semibold tracking-tight">We couldn&apos;t find that subject.</h1>
          <Link href="/subjects" className="btn-primary mt-6">Back to subjects</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="calibrate-material-page animate-rise">
      <section className="calibrate-material-card">
        <Link href="/subjects" className="calibrate-material-back">← Subjects</Link>
        <p className="calibrate-material-eyebrow">Study material</p>
        <p className="calibrate-material-subject">
          <span style={{ background: subject.color }} aria-hidden="true" />
          Subject: {subject.name}
        </p>
        <h1>Add study material</h1>
        <p className="calibrate-material-intro">Use notes from the class you&apos;re actually studying.</p>

        {saved ? (
          <div className="calibrate-material-success" role="status">
            <p className="label">Material ready</p>
            <h2>Your notes are saved for {subject.name}.</h2>
            <p>Question generation will be connected in the next step. For now, your material is ready.</p>
            <div className="calibrate-material-actions">
              <button type="button" className="calibrate-button calibrate-button-teal" onClick={() => { setSaved(false); setTitle(""); setContent(""); }}>
                Add another material
              </button>
              <Link href="/subjects" className="calibrate-button calibrate-button-outline">Back to subjects</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="calibrate-material-sources" role="tablist" aria-label="Choose material source">
              <button type="button" role="tab" aria-selected={source === "pdf"} className={source === "pdf" ? "is-selected" : ""} onClick={() => setSource("pdf")}>
                <span>1</span> Upload PDF <small>Recommended</small>
              </button>
              <button type="button" role="tab" aria-selected={source === "notes"} className={source === "notes" ? "is-selected" : ""} onClick={() => setSource("notes")}>
                <span>2</span> Paste notes
              </button>
            </div>

            {source === "pdf" ? (
              <div className="calibrate-upload-panel" role="tabpanel">
                <p className="label">Upload PDF</p>
                <h2>Choose a class PDF to prepare.</h2>
                <p>PDF processing will be connected in the next milestone. Choose a file now to confirm the material you want to use.</p>
                <label className="calibrate-upload-dropzone">
                  <input type="file" accept="application/pdf,.pdf" onChange={chooseFile} />
                  <span className="calibrate-upload-icon" aria-hidden="true">↑</span>
                  <strong>{file ? file.name : "Select a PDF"}</strong>
                  <small>{file ? "PDF selected and ready for the upcoming material pipeline." : "PDF files only. You can replace it before continuing."}</small>
                </label>
                {file && (
                  <button type="button" className="calibrate-upload-remove" onClick={() => setFile(null)}>
                    Remove selected file
                  </button>
                )}
              </div>
            ) : (
              <div className="calibrate-notes-panel" role="tabpanel">
                <div>
                  <label htmlFor="material-title" className="calibrate-material-field-label">Material title</label>
                  <input id="material-title" className="field" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Chapter 5 Lecture Notes" />
                </div>
                <div>
                  <label htmlFor="material-content" className="calibrate-material-field-label">Notes</label>
                  <textarea id="material-content" className="field min-h-56 resize-y" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Paste notes from one lecture, chapter, or study section…" />
                  <p className="calibrate-material-helper">Keep this to one lecture, chapter, or study section at a time.</p>
                </div>
                <button type="button" className="calibrate-button calibrate-button-teal self-start" onClick={saveNotes} disabled={saving || !title.trim() || !content.trim()}>
                  {saving ? "Saving material…" : "Save material"}
                </button>
              </div>
            )}
            {error && <p className="calibrate-form-error mt-4" role="alert">{error}</p>}
          </>
        )}
      </section>
    </div>
  );
}