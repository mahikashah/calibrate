# Calibrate — ML / Prompt Generation Branch

This branch covers the AI question-generation pipeline: parsing student notes from PDFs, grounding LLM-generated quiz questions in that material, and testing for hallucination/quality across subjects.

## Overview

The goal of this work is to generate quiz questions **strictly grounded in a student's own notes**, rather than relying on general LLM knowledge — this keeps question quality consistent across subjects (including niche ones) and protects the validity of the study-technique experiment loop the rest of the app is built around.

Current approach: **in-context grounding, no RAG for v1.** Notes are pasted/parsed in full and passed directly into the prompt, with a token-count check to guard against context overflow/degradation. This may be revisited if notes routinely exceed a reasonable size.

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
Tests question generation quality (grounding/hallucination) from parsed notes, pasted in-context, per subject. Currently using **Qwen2.5-7B-Instruct** via the Hugging Face inference router.

```
python3 llm_question_generation_test.py <parsed_data.json> <subject>
```

- Pulls the matching subject's notes from the parsed JSON, builds a prompt, and calls the model via HF's router API.
- Prompt enforces: questions grounded strictly in provided notes (no outside facts), exactly 6 questions when material supports it (fewer if not), numbered-list-only output with no preamble/closing text, and a source excerpt after each question.
- Outputs one `.txt` file per subject (e.g., `chicano_studies_generated_questions.txt`).

**Currently tested against 4 real subjects** (using notes collected from myself + friends):
- Chicano Studies
- Probability / Statistics
- Neuroscience / Cognitive Neuroscience
- English / Literature

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
- **Question caching** — plan to save user-edited questions as canonical going forward, to avoid repeating hallucinated content on the same topic. Not yet implemented — flagged as a good candidate for later scope, currently out of v1 build time.
- **Hallucination guardrails** — prompt explicitly instructs the model to generate fewer questions rather than invent content when notes are sparse, and to cite a source excerpt per question for manual fact-checking during eval.

## Next steps

- [ ] Finalize token-limit cap and hard-stop vs. truncate behavior (needs UI coordination with frontend)
- [ ] Parse raw generated output into structured rows (question + source excerpt) for CSV/eval logging
- [ ] Build out full eval set (expected vs. actual output) to systematically track hallucination rate across subjects
- [ ] Define and document the input/output contract for Dev integration (what the API needs to send/receive)
- [ ] Test behavior on sparse/thin notes specifically (edge case for hallucination risk)