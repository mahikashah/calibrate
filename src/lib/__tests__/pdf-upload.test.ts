import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NOT_A_PDF_MESSAGE,
  PDF_MAX_BYTES,
  PDF_TOO_LARGE_MESSAGE,
  pdfUploadError,
} from "../pdf-upload";
import { generateQuestions, MlServiceError } from "../ml-service";

describe("pdfUploadError", () => {
  it("accepts a PDF by MIME type or by .pdf extension", () => {
    expect(pdfUploadError({ name: "a.bin", type: "application/pdf", size: 10 })).toBeNull();
    expect(pdfUploadError({ name: "Lecture.PDF", type: "", size: 10 })).toBeNull();
  });

  it("rejects non-PDFs and files over the size cap", () => {
    expect(pdfUploadError({ name: "a.docx", type: "application/msword", size: 10 })).toBe(
      NOT_A_PDF_MESSAGE,
    );
    expect(pdfUploadError({ name: "a.pdf", type: "application/pdf", size: PDF_MAX_BYTES })).toBeNull();
    expect(
      pdfUploadError({ name: "a.pdf", type: "application/pdf", size: PDF_MAX_BYTES + 1 }),
    ).toBe(PDF_TOO_LARGE_MESSAGE);
  });
});

describe("ML client NOTES_TOO_LONG message", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubMlError(body: unknown) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(body), { status: 413 })),
    );
  }

  async function caught(): Promise<MlServiceError> {
    try {
      await generateQuestions({ subject: "Bio", text: "x", requestedCount: 1 });
    } catch (err) {
      return err as MlServiceError;
    }
    throw new Error("expected generateQuestions to throw");
  }

  it("includes the word count and limit reported by the service", async () => {
    stubMlError({ code: "NOTES_TOO_LONG", word_count: 5200, word_limit: 4600 });
    const err = await caught();
    expect(err.code).toBe("NOTES_TOO_LONG");
    expect(err.studentMessage).toContain("5,200 words");
    expect(err.studentMessage).toContain("4,600");
  });

  it("falls back to the generic copy when the counts are missing", async () => {
    stubMlError({ code: "NOTES_TOO_LONG" });
    const err = await caught();
    expect(err.studentMessage).toBe(
      "This material is too long. Try one lecture, chapter, or study section at a time.",
    );
  });
});
