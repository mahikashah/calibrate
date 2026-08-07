# Calibrate ML Service

This is an isolated FastAPI service that adapts Shreya's Python PDF extraction
and Hugging Face Qwen question-generation pipeline for Calibrate.

It has **no database** and does not manage users, subjects, materials, sessions,
or questions. The Next.js Calibrate app remains responsible for those concerns.
Next.js integration is deliberately **not** part of this milestone.

## Setup

From the repository root:

```bash
cd ml-service
python -m pip install -r requirements.txt
cp .env.example .env
```

Set `HF_TOKEN` in `.env` only when you want to make a real Hugging Face request.
Tests mock the provider and do not require a token.

## Run

```bash
cd ml-service
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Interactive documentation is available at `/docs`.

## Configuration

| Variable | Purpose | Default |
|---|---|---|
| `HF_TOKEN` | Hugging Face bearer token | none |
| `HF_MODEL` | Question-generation model | `Qwen/Qwen2.5-7B-Instruct` |
| `HF_ENDPOINT` | Hugging Face chat endpoint | HF Inference Router endpoint |
| `GENERATION_TIMEOUT_SECONDS` | Provider timeout | `90` |
| `WORD_LIMIT` | Maximum input words | `4600` |
| `ML_SERVICE_API_KEY` | Optional server-to-server key | none |

When `ML_SERVICE_API_KEY` is set, send it to protected endpoints as:

```http
X-ML-Service-Key: your-service-key
```

`GET /health` remains unprotected for deployment health checks.

## Endpoints

### `GET /health`

```json
{"ok": true}
```

### `POST /parse-pdf`

Accepts a `multipart/form-data` `file` field. Only text-based PDFs are
supported; scanned/image-only PDFs return `UNSUPPORTED_PDF`. No OCR is used.

Success response:

```json
{
  "text": "Cleaned extracted text",
  "word_count": 1234,
  "approx_token_count": 1641,
  "file_name": "chapter5.pdf"
}
```

### `POST /generate-questions`

Request:

```json
{
  "subject": "Neuroscience",
  "text": "Normalised class notes",
  "requested_count": 6
}
```

`requested_count` accepts 1–10 and defaults to 6. Inputs above 4,600 words are
rejected rather than truncated.

Success response:

```json
{
  "questions": [
    {
      "type": "active_recall",
      "question": "What is the main concept?",
      "answer": "The reference answer.",
      "answer_choices": [],
      "source_excerpt": "Supporting text from the supplied notes."
    }
  ]
}
```

The supported types are `active_recall`, `mcq`, `feynman`, and
`fill_in_blank`. MCQs must have exactly four choices and their answer must
exactly match one choice. Other types must have an empty `answer_choices` list.

## Errors

All service errors use:

```json
{
  "success": false,
  "code": "NOTES_TOO_LONG",
  "message": "Your notes are too long. Please use one lecture, chapter, or study section at a time."
}
```

The service can return: `PDF_PARSE_FAILED`, `UNSUPPORTED_PDF`,
`NOTES_TOO_LONG`, `MODEL_TIMEOUT`, `INVALID_MODEL_RESPONSE`,
`GENERATION_FAILED`, and `UNAUTHORIZED`.

## Evaluation tooling

Shreya's `eval_generated_questions.py` and `llm_judge_eval.py` are offline/dev
evaluation tools. They are intentionally excluded from this service and never
run in a student generation request.