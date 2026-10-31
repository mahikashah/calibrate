/** Shared PDF upload rules, checked in the browser and again on the server. */

// Vercel rejects request bodies over 4.5 MB before our route runs, with an
// opaque error. Capping below that keeps the student-facing message ours.
// This is a transport limit only; the word limit enforced by the ML service
// is what decides whether the extracted text is short enough.
export const PDF_MAX_BYTES = 4 * 1024 * 1024;
export const PDF_MAX_LABEL = "4 MB";

export const PDF_TOO_LARGE_MESSAGE = `This PDF is larger than ${PDF_MAX_LABEL}. Try one lecture or chapter at a time, or paste your notes instead.`;
export const NOT_A_PDF_MESSAGE = "Please select a PDF file.";

/**
 * Some browsers and operating systems report an empty MIME type for a valid
 * .pdf, so accept either the PDF type or the .pdf extension.
 */
export function isPdfFile(file: { type: string; name: string }): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

/** Returns a student-facing error, or null when the file can be uploaded. */
export function pdfUploadError(file: { type: string; name: string; size: number }): string | null {
  if (!isPdfFile(file)) return NOT_A_PDF_MESSAGE;
  if (file.size > PDF_MAX_BYTES) return PDF_TOO_LARGE_MESSAGE;
  return null;
}
