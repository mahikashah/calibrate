# Calibrate — ML Integration Contract

_Created: 2026-08-07_
_Based on inspection of: `origin/shreya-ml` at commit `d163b0ead66d9904831747cc787062a7dd288379` (2026-08-06)_
_Status: DRAFT — requires Shane + Shreya review before implementation_

---

## 1. Executive Summary

Shreya's branch (`origin/shreya-ml`) contains a working Python pipeline that can
parse PDF lecture notes, count tokens, and call a Hugging Face–hosted LLM to
produce structured practice questions.

The pipeline currently lives as a set of **CLI batch scripts**, not as a web
service. It has never been wired to the Calibrate Next.js application.

This document captures exactly what the pipeline does today and proposes the
minimal integration contract Shane and Shreya need to agree on before
implementation begins.

**Nothing in this document changes production code.** It is a planning artifact
for review.

---

## 2. Actual Shreya Pipeline Discovered

| File | Role |
|---|---|
| `pdf_parser.py` | **Production** — extracts text from PDFs, emits JSON |
| `llm_question_generation.py` | **Production** — sends extracted (or raw) text to LLM, returns structured questions |
| `context_token_count.py` | **Production utility** — counts exact tokens per subject using the same model's tokenizer |
| `eval_generated_questions.py` | **Evaluation only** — human-review scoring of v1 text output (not v2 JSON) |
| `llm_judge_eval.py` | **Evaluation only** — LLM-as-judge automated scoring of v2 JSON output |

---

## 3. Production Python Files

### `pdf_parser.py`

CLI script that reads a folder of PDFs, maps each file to a subject name from a
separate subjects list, extracts text with `pdfplumber`, and writes a JSON array
to an output file.

**Entry point:** `python pdf_parser.py <pdf_folder> <subjects_file> <output.json>`

Key behaviour:
- Uses `pdfplumber` for text extraction (typed/text PDFs only).
- Iterates pages; silently skips pages that return no text.
- Joins page text with `\n`.
- `clean_text()` collapses 3+ consecutive newlines to 2, and 2+ spaces/tabs to one space.
- Maps PDF index `i` to `subjects[i]` — mismatched list lengths will raise `IndexError`.
- Skips entirely empty files with a console warning.
- Does **not** raise on corrupt or encrypted PDFs; such files silently produce empty text and are skipped.

**Output shape per document:**

```json
{
  "id": "<PDF stem without extension>",
  "subject": "<subject name from list>",
  "file_name": "<original PDF filename>",
  "text": "<cleaned extracted text>",
  "word_count": 5140,
  "approx_token_count": 6836,
  "date_uploaded": "<ISO datetime string>"
}
```

> ⚠️ **Field-name discrepancy:** older planning documents use `filename` and
> `approx_tokens`. The actual code and `parsed_data.json` use `file_name` and
> `approx_token_count`. Use the code names.

> ⚠️ **Subject trailing comma:** `parsed_data.json` contains `"subject":
> "Chicano Studies,"` (note the trailing comma). This is a data-entry artefact
> that must be stripped during normalisation. The generation script compensates
> by stripping commas during lookup; the integration layer must do the same.

### `llm_question_generation.py`

CLI script that reads the `parsed_data.json` array, finds the matching subject
entry, builds a chat prompt, and calls the Hugging Face router API to generate
structured questions.

**Entry point:** `python llm_question_generation.py <parsed_data.json> <subject_name> <output.json>`

Key behaviour:
- Loads `HF_TOKEN` from `.env` via `python-dotenv`.
- Endpoint: `https://router.huggingface.co/v1/chat/completions`
- Model: `Qwen/Qwen2.5-7B-Instruct`
- Subject matching: `normalized = subject.lower().strip(',')`. Uses the **first** match; warns on duplicates.
- Builds context string: `Subject:{subject}\nNotes:{notes}\n`.
- Request: `max_tokens=2000`, no temperature set (model default).
- Timeout: 90 seconds; `requests` errors become `RuntimeError`.
- Warns to console if `finish_reason == "length"` (response truncated).
- Extracts a JSON array from the response text, then `json.loads()`; on JSON decode
  failure it reports and returns a failure value.

> ⚠️ **`WORD_LIMIT = 4600` is declared but never enforced.** No truncation or
> rejection occurs when input exceeds this limit. The token limit must be
> implemented at the FastAPI layer.

### `context_token_count.py`

Utility that counts exact token lengths using the same model's tokenizer
(`Qwen/Qwen2.5-7B-Instruct` from `transformers.AutoTokenizer`). Not used at
runtime; useful for setting the actual production limit.

**Note:** Loading this tokenizer requires a network download and Hugging Face
access. It is not lightweight.

---

## 4. Evaluation-Only Python Files

These files should **not** be called during the synchronous student question-
generation flow.

| File | What it does |
|---|---|
| `eval_generated_questions.py` | Parses v1 text output; prompts a human reviewer to grade each question as grounded/well-formed. Writes a CSV. |
| `llm_judge_eval.py` | Sends all v2 JSON questions for a subject to the same LLM with a judging prompt. Scores grounded / correct / well-formed / reason. Retries up to 3× on bad JSON. Writes a CSV. |

Keep these scripts as offline/dev tooling only.

---

## 5. Current Model and Provider

| Item | Value |
|---|---|
| Provider | Hugging Face Inference Router |
| Endpoint | `https://router.huggingface.co/v1/chat/completions` |
| Model | `Qwen/Qwen2.5-7B-Instruct` |
| Auth | `Authorization: Bearer <HF_TOKEN>` |
| Generation timeout | 90 seconds |
| Generation `max_tokens` | 2000 |

The existing Calibrate Next.js application uses a **completely separate** LLM
provider abstraction (`src/lib/llm/`) with `LLM_PROVIDER`, `OPENAI_BASE_URL`,
`OPENAI_API_KEY`, `OPENAI_MODEL`. These are two different systems and must not
be conflated.

---

## 6. Required Python Dependencies

No `requirements.txt`, `pyproject.toml`, or `Pipfile` exists in the branch.
Dependencies are inferred from import statements:

| Package | Used in |
|---|---|
| `pdfplumber` | `pdf_parser.py` |
| `transformers` | `context_token_count.py` (loads Qwen tokenizer) |
| `python-dotenv` | `llm_question_generation.py` |
| `requests` | `llm_question_generation.py`, `llm_judge_eval.py` |

> ⚠️ **Action required:** Shreya should create `requirements.txt` (or
> `pyproject.toml`) listing exact pinned versions before the FastAPI service is
> deployed.

---

## 7. Required Secret / Environment Variable Names

| Name | Used for | Where set |
|---|---|---|
| `HF_TOKEN` | Hugging Face bearer token for LLM inference | `.env` file (python-dotenv) |

> All other configuration (endpoint URL, model name) is currently hardcoded in
> `llm_question_generation.py`. Before production deployment, these should be
> moved to environment variables so they can be swapped without code changes.

**Proposed additional env vars for the FastAPI service:**

| Name | Purpose |
|---|---|
| `HF_TOKEN` | Existing HF token (rename or alias as needed) |
| `HF_MODEL` | Qwen model ID (currently hardcoded) |
| `HF_ENDPOINT` | HF router URL (currently hardcoded) |
| `GENERATION_TIMEOUT_SECONDS` | Currently hardcoded 90 |
| `WORD_LIMIT` | Currently hardcoded 4600 / unenforced |

On the Next.js side, add:

| Name | Purpose |
|---|---|
| `ML_SERVICE_URL` | Base URL of the FastAPI service |
| `ML_SERVICE_API_KEY` | Optional shared secret for service-to-service auth |

> Do not set any of these secrets in the repository or in browser-accessible
> code. See Section 17.

---

## 8. PDF Parser: Input / Output / Limitations

| Area | Detail |
|---|---|
| Input | File path to a text-encoded PDF |
| Library | `pdfplumber` |
| Scanned PDFs | **Not supported.** No OCR. Empty text extracted; file silently skipped. |
| Encrypted PDFs | No explicit handling; likely raises or silently skips. |
| Output fields | `id`, `subject`, `file_name`, `text`, `word_count`, `approx_token_count`, `date_uploaded` |
| Token approximation | `word_count × 1.33` (rough; not the exact tokenizer count) |
| Exact token count | Available via `context_token_count.py` (requires transformers + network) |
| Metadata | No PDF metadata (author, title, page count) extracted beyond filename |
| Failure behaviour | Warns and skips; does not raise on empty result |

**In the FastAPI context,** `POST /parse-pdf` should:
1. Accept a PDF file upload.
2. Extract text with `pdfplumber`.
3. Return the normalised text, word count, and approximate token count.
4. Return a structured error (see Section 15) if the PDF is empty/unreadable.

---

## 9. Token / Length Behaviour

| Item | Current state |
|---|---|
| Declared limit | `WORD_LIMIT = 4600` words (~6000 tokens by 1.33× approximation) |
| Enforced? | **No.** The constant is declared but never used. |
| Exact tokenizer | `Qwen/Qwen2.5-7B-Instruct` via `transformers.AutoTokenizer` |
| Truncation | None currently implemented |
| Over-limit behaviour | Sends full text to LLM; may trigger `finish_reason: length` warning |

> ⚠️ **Mismatch:** Planning documents said "approximately 6,000 tokens" as the
> limit. The code declares 4,600 *words* (≈ 6,138 tokens) but does not enforce
> it. The exact enforced limit must be decided and implemented before production.

**Recommendation for FastAPI:** enforce `WORD_LIMIT` at the `/generate-questions`
endpoint. Reject inputs that exceed it with `NOTES_TOO_LONG` and a student-safe
message. Do not silently truncate.

---

## 10. Supported Question Types

The generation prompt explicitly requests exactly these four types:

| Type key | Description |
|---|---|
| `active_recall` | Open-ended recall question with a reference answer |
| `mcq` | Multiple-choice with exactly 4 choices |
| `feynman` | Explain-in-own-words prompt; answer is a key-concepts guide |
| `fill_in_blank` | Sentence with a blank; answer is the missing term |

The prompt requests **6 questions** per call. It instructs the model to generate
fewer if the notes do not support 6. The actual returned count may be less.

---

## 11. Current Structured Question Format

Exact field names from `generated_questions_v2/*.json` (source of truth):

```json
{
  "type": "mcq",
  "question": "Which of the following best describes ...",
  "answer": "Global decolonial movements and student protests",
  "answer_choices": [
    "Answer option A",
    "Answer option B",
    "Answer option C",
    "Answer option D"
  ],
  "source_excerpt": "verbatim excerpt from the original notes"
}
```

| Field | Required | Notes |
|---|---|---|
| `type` | Yes | One of: `active_recall`, `mcq`, `feynman`, `fill_in_blank` |
| `question` | Yes | The question or prompt text |
| `answer` | Yes | Reference answer or key-concepts guide |
| `answer_choices` | Yes | `["A","B","C","D"]` for MCQ; `[]` for all other types |
| `source_excerpt` | Yes | Verbatim excerpt from notes the question is grounded in |

> No wrapper object or subject field appears in the per-question schema. The
> subject, `subjectId`, `materialId`, and `userId` are Calibrate database
> concerns and **should not be sent to the ML service**.

---

## 12. Recommended FastAPI Endpoints

Based on Shreya's actual code, the minimal clean service boundary is:

### `GET /health`
Confirms the service is running. Returns `{"ok": true}`.

---

### `POST /parse-pdf`

**Purpose:** Accept a student PDF upload, extract and normalise text, return
material metadata. Does not call the LLM.

**Request:** `multipart/form-data`
```
file: <PDF binary>
```

**Success response:**
```json
{
  "text": "<cleaned extracted text>",
  "word_count": 5140,
  "approx_token_count": 6836,
  "file_name": "chapter5.pdf"
}
```

**Failure response:** See Section 15.

---

### `POST /generate-questions`

**Purpose:** Accept normalised text (from PDF extraction or pasted notes) and
return structured questions. Does not know about users, subjects, or materials.

**Request body:**
```json
{
  "subject": "Neuroscience",
  "text": "<normalised material text>",
  "requested_count": 6
}
```

> `subject` is passed to the model for prompt context only. `subjectId`,
> `materialId`, and `userId` stay on the Next.js side and are never sent here.

**Success response:**
```json
{
  "questions": [
    {
      "type": "active_recall",
      "question": "...",
      "answer": "...",
      "answer_choices": [],
      "source_excerpt": "..."
    },
    {
      "type": "mcq",
      "question": "...",
      "answer": "...",
      "answer_choices": ["A", "B", "C", "D"],
      "source_excerpt": "..."
    }
  ]
}
```

---

## 13. Request Schema

### `/generate-questions` full field table

| Field | Type | Required | Notes |
|---|---|---|---|
| `subject` | string | Yes | Subject name for prompt context only (e.g. "Neuroscience") |
| `text` | string | Yes | Normalised material text from PDF extraction or pasted notes |
| `requested_count` | integer | No | Default 6; capped at a configurable maximum |

**Fields that stay on the Next.js side (never sent to FastAPI):**

| Field | Why it stays in Next.js |
|---|---|
| `userId` | Ownership is a Calibrate concern |
| `subjectId` | Database foreign key; Calibrate resolves it |
| `materialId` | Same; created by Calibrate before calling FastAPI |

---

## 14. Response Schema

See Section 12. The normalised response Calibrate should validate before storing:

```json
{
  "questions": [
    {
      "type": "string — one of active_recall | mcq | feynman | fill_in_blank",
      "question": "string — required",
      "answer": "string — required",
      "answer_choices": "array<string> — [] for non-MCQ, exactly 4 strings for MCQ",
      "source_excerpt": "string — required, verbatim from input text"
    }
  ]
}
```

**Calibrate validation rules before storing:**
- Each object must have all five fields.
- `type` must be one of the four known values.
- MCQ: `answer_choices` must have exactly 4 items; `answer` must match or be present among them.
- `source_excerpt` must not be empty.
- Malformed or missing questions should be rejected, not silently stored.

---

## 15. Error Schema

All FastAPI errors should return a consistent machine-readable shape:

```json
{
  "success": false,
  "code": "NOTES_TOO_LONG",
  "message": "Your notes are too long. Please use one lecture, chapter, or study section at a time."
}
```

| Code | Trigger | Student-visible message |
|---|---|---|
| `PDF_PARSE_FAILED` | pdfplumber raises or returns no text | "We couldn't read this PDF. Please try a different file." |
| `UNSUPPORTED_PDF` | Scanned/image-only PDF detected | "This PDF appears to be scanned. Please use a text-based PDF or paste your notes." |
| `NOTES_TOO_LONG` | Input exceeds word/token limit | "Your notes are too long. Please use one lecture, chapter, or study section at a time." |
| `MODEL_TIMEOUT` | 90-second request timeout | "The question generator is taking too long. Please try again." |
| `INVALID_MODEL_RESPONSE` | LLM response is not valid JSON | "The question generator returned an unexpected result. Please try again." |
| `GENERATION_FAILED` | Any other generation error | "Question generation failed. Please try again." |

> Never expose provider stack traces, HF token names, or model error messages to
> the browser. Log them server-side only.

---

## 16. Responsibility Split

### Next.js (Calibrate application) owns:

- Current user identity and session
- Subject and material ownership validation
- Creating and storing `Material` records
- `userId`, `subjectId`, `materialId` assignment
- Calling `/parse-pdf` and `/generate-questions` server-side only
- Validating the returned question array before writing to the database
- Storing questions with `status: "generated"`
- Question Bank review UI (approve / edit / reject)
- Study Session rendering
- Outcomes and feedback
- Insights and recommendations

### FastAPI (Python ML service) owns:

- PDF text extraction (`pdfplumber`)
- Text normalisation / cleaning
- Token / word-count validation and enforcement
- Building and executing the LLM prompt
- Parsing and validating LLM JSON output
- Returning structured questions in the agreed schema
- Returning structured errors in the agreed schema

**FastAPI must not** persist data, manage users, or become a second Calibrate
database.

---

## 17. Security / Request Path

**Correct:**
```
Student browser
    ↓
Calibrate Next.js API route (server-side only)
    ↓
FastAPI ML service (internal / not browser-reachable)
    ↓
Hugging Face / model provider
```

**Never:**
```
Student browser → FastAPI directly
Student browser → HF endpoint directly
```

This keeps `HF_TOKEN` and `ML_SERVICE_API_KEY` server-side. Neither is ever sent
to the browser or stored in client-side code.

---

## 18. Discrepancies Between Previous Assumptions and Actual Code

| Assumption in planning docs | Reality in Shreya's branch |
|---|---|
| Token limit is ~6,000 tokens and enforced | `WORD_LIMIT = 4600` words (≈ 6,138 tokens) is **declared but never enforced** |
| PDF parser output field is `filename` | Actual field name is `file_name` |
| PDF parser output field is `approx_tokens` | Actual field name is `approx_token_count` |
| Pipeline is ready to be called as a service | It is **a batch CLI tool only**; no HTTP layer exists yet |
| README says offline/mock LLM (Next.js default) | Python scripts require live `HF_TOKEN` and network access |
| `requirements.txt` exists | **Does not exist**; dependencies are inferred from imports only |
| subject field in data is clean | `parsed_data.json` has `"Chicano Studies,"` with a trailing comma; generation script strips it, but any integration layer must do the same |
| 6 questions always returned | Prompt requests 6 but instructs the model to return fewer if notes do not support it |

---

## 19. Open Questions for Shane and Shreya

These must be resolved before implementation begins.

1. **Token limit:** What is the agreed enforced limit in tokens/words? Should the
   FastAPI layer truncate silently or reject with `NOTES_TOO_LONG`?

2. **`requirements.txt`:** Shreya should create this with pinned versions before
   the FastAPI service is containerised or deployed.

3. **Scanned PDF detection:** How should the service detect a scanned PDF
   (empty pdfplumber output)? Should it return `UNSUPPORTED_PDF` immediately?

4. **Model portability:** `Qwen/Qwen2.5-7B-Instruct` is currently hardcoded. Should
   the model be configurable via `HF_MODEL` env var so it can be swapped without
   code changes?

5. **Service auth:** Should the Next.js → FastAPI connection use a shared
   `ML_SERVICE_API_KEY` header, IP allowlisting, or something else?

6. **PDF upload path:** When the student selects a PDF in the material-intake
   UI, does the browser send it to Next.js, which forwards it to `/parse-pdf`?
   Or does Next.js stream it? Agree on the upload flow before implementation.

7. **Question count:** Is 6 the right default? Should `requested_count` be
   configurable per subject, or always 6?

8. **MCQ answer validation:** Should `answer` always be one of the
   `answer_choices` strings exactly (for programmatic grading), or is it allowed
   to be a paraphrase?

9. **`finish_reason: length` warning:** If the model truncates its response, is
   a partial question set acceptable, or should the call fail with
   `GENERATION_FAILED`?

10. **Evaluation tooling deployment:** `llm_judge_eval.py` calls the same LLM
    for scoring. Should evaluation have its own service budget/quota separate from
    production generation?

---

## Appendix A — Actual `parsed_data.json` sample entry

```json
{
  "id": "CHI 10 - Lecture Notes - Google Docs",
  "subject": "Chicano Studies,",
  "file_name": "CHI 10 - Lecture Notes - Google Docs.pdf",
  "text": "...",
  "word_count": 5140,
  "approx_token_count": 6836,
  "date_uploaded": "2026-08-06T..."
}
```

---

## Appendix B — Generated question samples (from `generated_questions_v2/`)

### MCQ example
```json
{
  "type": "mcq",
  "question": "Which of the following best describes the establishment of Chicano Studies departments?",
  "answer": "Global decolonial movements and student protests",
  "answer_choices": [
    "Federal government mandates",
    "Global decolonial movements and student protests",
    "Individual university decisions",
    "Private foundation funding"
  ],
  "source_excerpt": "verbatim excerpt from lecture notes"
}
```

### Fill-in-the-blank example
```json
{
  "type": "fill_in_blank",
  "question": "The term ___ encompasses people of hispanic, mexican, and mexican american descent.",
  "answer": "hispanic, mexican, and mexican american",
  "answer_choices": [],
  "source_excerpt": "verbatim excerpt from lecture notes"
}
```

### Active recall example
```json
{
  "type": "active_recall",
  "question": "What were the primary motivations behind the Chicano Movement?",
  "answer": "...",
  "answer_choices": [],
  "source_excerpt": "verbatim excerpt from lecture notes"
}
```
