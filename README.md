# Calibrate — ML / Prompt Generation Branch

This branch covers the AI question-generation pipeline: parsing student notes from PDFs, grounding LLM-generated quiz questions in that material, and evaluating output for hallucination/quality/correctness across subjects.

## Overview

The goal of this work is to generate quiz questions **strictly grounded in a student's own notes**, rather than relying on general LLM knowledge — this keeps question quality consistent across subjects (including niche ones) and protects the validity of the study-technique experiment loop the rest of the app is built around.

Current approach: **in-context grounding, no RAG for v1.** Notes are pasted/parsed in full and passed directly into the prompt, with a token-count check to guard against context overflow/degradation. This may be revisited if notes routinely exceed a reasonable size.

Generation output is in a **structured JSON** format, with each question typed (active recall / MCQ / Feynman / fill-in-the-blank) and paired with a verbatim source excerpt — this both improves parsing reliability and enables automated grounding checks via LLM-as-judge.

## Scripts

### `extract_notes.py`
Extracts text from a folder of digital (typed) PDF notes into a structured JSON eval set, with subject labels pulled from a separate subjects file.

```
python3 extract_notes.py <pdf_folder> <subjects.txt> <output.json>
```

- `subjects.txt` — one subject per line, matched to PDFs by sort order (see script docstring for details on aligning filenames).
- Output JSON includes `id`, `subject`, `filename`, `text`, `word_count`, and `approx_tokens` per note.
- Skips PDFs with no extractable text (likely scanned/image-based — would need OCR, not yet supported).

### `count_tokens.py`
Counts the exact token size of each subject's notes (using the Qwen2.5-7B-Instruct tokenizer) to inform the token-limit boundary for context grounding.

```
python3 count_tokens.py <parsed_data.json> <output.csv>
```

Outputs a CSV of `subject, token_count` for every note in the parsed data.

### `llm_question_generation_test.py`
Generates quiz questions from parsed notes, pasted in-context, per subject. Currently using **Qwen2.5-7B-Instruct** via the Hugging Face inference router.

```
python3 llm_question_generation_test.py <parsed_data.json> <subject>
```

- Pulls the matching subject's notes from the parsed JSON and calls the model via HF's router API.
- Prompt enforces: questions grounded strictly in provided notes (no outside facts), exactly 6 questions when material supports it (fewer if not), and a mix of four question types based on what the material supports:
  - **active_recall** — open-ended recall of a specific fact/concept
  - **mcq** — multiple choice, exactly 4 answer choices
  - **feynman** — explain-in-your-own-words style question
  - **fill_in_blank** — sentence from the notes with a key term blanked out
- Output is **strict JSON** (no markdown fences, no preamble) — each question includes `type`, `question`, `answer`, `answer_choices` (populated for MCQ, empty otherwise), and `source_excerpt` (a verbatim quote from the notes, used for grounding verification).
- Output is validated as parseable JSON before saving; malformed/truncated responses are caught immediately and saved to a `.raw.txt` file for debugging instead of silently corrupting the output.
- Outputs one `.json` file per subject (e.g., `chicano_studies_generated_questions.json`).

**Currently tested against 4 real subjects** (using notes collected from myself + friends):
- Chicano Studies
- Probability / Statistics
- Neuroscience / Cognitive Neuroscience
- English / Literature

### `build_eval_sheet.py`
Builds a manual-review CSV from generated output, pairing each question with the full subject notes for side-by-side scoring (groundedness, source match, well-formedness). Used as the initial manual baseline before trusting automated judging.

```
python3 build_eval_sheet.py <parsed_data.json> <generated_output_dir> <eval_sheet.csv>
```

### `llm_judge_eval.py`
Automated LLM-as-judge evaluation — scores every generated question for **groundedness**, **correctness** (does the answer actually answer the question), and **well-formedness**, batched one call per subject (all questions + full notes sent together) to minimize API/credit usage.

```
python3 llm_judge_eval.py <parsed_data.json> <generated_output_dir> <eval_results.csv>
```

- Judge model: **DeepSeek-V3-0324** (MIT license — clean for commercial/online deployment; different lineage from the Qwen generator to reduce self-preference and family-level bias in judging).
- Includes a fast, non-LLM pre-check (`excerpt_appears_in_notes`) that verifies each `source_excerpt` actually appears (verbatim or near-verbatim, via fuzzy matching) in the subject's notes — independent of and complementary to the LLM judge's own verdict.
- Handles markdown-fenced/prefaced model output (`extract_json_array`), and includes retry logic (up to 3 attempts) plus tuned `temperature`/`frequency_penalty` to guard against and recover from occasional degenerate/repetition-loop judge output.
- Has been run against all 4 subjects; outputs a CSV with per-question `grounded`, `correct`, `well_formed`, and `judge_reason`, plus an aggregate summary printed to console (e.g., "Grounded: 22/24 (92%)").

## Input / Output Contract (for Dev integration)

### Input

A single subject's notes as plain text, plus the subject name:

```json
{
  "id": "Copy of Study Guide for Neurosci test ",
  "subject": "Neuroscience,",
  "file_name": "Copy of Study Guide for Neurosci test .pdf",
  "text": "1: How did animal brains evolve?\n...",
  "date": "2026-08-06T14:30:22.104931"
}
```
Input includes parameters such as `word_count` and `approx_token_count` for token limit / word limit creation.

- `notes` can come from either the paste box or PDF upload (once extracted to text) — same downstream handling either way.
- **Token/word limit check happens before this is sent to the LLM.** Current cap: `TOKEN_LIMIT = 6000` tokens (≈4,511 words, using `words = tokens / 1.33`). This is a **hard stop, not a truncation** — reject with a clear error message rather than silently cutting off notes. See `token_limit.py`.
  - Real-time UI check (word/character counter) should use the approximate word limit for responsiveness; the actual token count (via tokenizer) is the source of truth for the hard-stop validation.

### Output

A JSON array of up to 6 question objects:

```json
[
  {
    "type": "mcq",
    "question": "Which structure is responsible for memory consolidation?",
    "answer": "Hippocampus",
    "answer_choices": ["Hippocampus", "Cerebellum", "Amygdala", "Thalamus"],
    "source_excerpt": "The hippocampus plays a critical role in consolidating short-term memories into long-term storage."
  },
  {
    "type": "active_recall",
    "question": "What is the function of the hippocampus?",
    "answer": "Memory consolidation and spatial navigation.",
    "answer_choices": [],
    "source_excerpt": "The hippocampus is involved in memory consolidation and spatial navigation."
  }
]
```

**Field notes:**
- `type` — one of `active_recall`, `mcq`, `feynman`, `fill_in_blank`. Model chooses a mix based on what the material supports; no fixed distribution enforced.
- `question` — for `fill_in_blank`, includes `____` marking the blank.
- `answer_choices` — populated with exactly 4 strings (including the correct one) only when `type` is `mcq`; empty array `[]` otherwise. Always present as a field regardless of type, so downstream code doesn't need type-specific branching just to read the response.
- `source_excerpt` — intended to be a verbatim quote from the notes. **Known limitation:** eval data shows the model paraphrases this excerpt in practice for roughly half of generated questions, even though question/answer content remains accurate per LLM-judge review (see Eval results below). Don't treat `excerpt_found_in_notes`-style verbatim matching as a hard guarantee.
- Fewer than 6 questions is expected/valid behavior when notes are sparse — this is intentional (see hallucination guardrails below), not a bug.

**Validation before returning to the user:**
- Response must be valid JSON (array) — malformed/truncated model output should be caught server-side and either retried or surfaced as a generation error, not passed through to the frontend as-is.
- Recommend the same JSON-array extraction the judge script uses (`extract_json_array` in `llm_judge_eval.py`) as a defensive layer, since models sometimes wrap output in markdown fences or add preamble text despite instructions not to.

### Error cases to handle user-side

| Condition | Expected behavior |
|---|---|
| Notes exceed token/word limit | Reject before calling the LLM; show the student a clear "notes too long" message with the word limit |
| Model returns malformed JSON | Retry once or twice server-side; if still failing, surface a generic "couldn't generate questions, try again" error — don't show raw model output to the user |
| Notes too sparse for 6 questions | Valid — return however many questions were generated (could be fewer than 6); no error needed |

## Setup

1. Install dependencies:
   ```
   pip install python-dotenv requests transformers --break-system-packages
   ```
2. Create a `.env` file in the project root (not committed — already in `.gitignore`):
   ```
   HF_TOKEN=hf_your_token_here
   ```
   Token should be a **Read** (or fine-grained, inference-only) token from Hugging Face — no write access needed.

## Design notes / decisions so far

- **No RAG for v1** — chose in-context grounding over retrieval given the realistic scale of a single study session's notes (a page or two). Revisit if notes need to persist/scale across many sessions.
- **Token-limit boundary** — needed to prevent context rot (degraded question specificity) as notes grow. `count_tokens.py` is the tool for measuring this; exact limit still to be finalized with the team.
- **Structured JSON output** — moved from free-text/numbered-list generation to strict JSON to eliminate fragile parsing (dashes/newlines inside questions or answers were breaking regex-based parsing) and to support typed questions (MCQ needs `answer_choices`; other types don't).
- **Four question types** — active recall, MCQ, Feynman, fill-in-the-blank — chosen per question by the model based on what the material supports, rather than a fixed distribution.
- **Source excerpt requirement** — every question includes a verbatim excerpt from the notes it's based on, enabling both a cheap mechanical grounding pre-check and a more targeted LLM-judge grounding check (compare excerpt + full notes, not just search the whole document).
- **LLM-as-judge over manual-only eval** — manual review (`build_eval_sheet.py`) established a baseline, but doesn't scale well; `llm_judge_eval.py` automates grounded/correct/well-formed scoring using a differently-sourced judge model, batched per subject to control API cost.
- **Question caching** — plan to save user-edited questions as canonical going forward, to avoid repeating hallucinated content on the same topic. Not yet implemented — flagged as a good candidate for later scope, currently out of v1 build time.

## Next steps

- [x] Finalize token-limit cap and hard-stop vs. truncate behavior (needs UI coordination with frontend)
- [ ] Review `llm_judge_eval.py` results across all 4 subjects (already run) against a manual spot-check sample to validate judge reliability
- [x] Define and document the input/output contract for Dev integration (see Input/Output Contract section above)
- [ ] Test behavior on sparse/thin notes specifically (edge case for hallucination risk)
- [ ] Decide on question caching implementation if time allows