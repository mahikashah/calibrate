# CALIBRATE MASTER CONTEXT

_Last updated: 2026-08-06_

This document is the shared product, design, engineering, and workflow context for **Calibrate**, an evidence-based AI study coach. It is intended to be used by Shane, ChatGPT/AI Engineer Mentor, Replit Agent, Cursor, and teammates as a durable source of truth.

---

## 1. Product Summary

**Calibrate** is an evidence-based AI study coach that helps students determine which study techniques work best for them through experimentation rather than fixed learning-style labels.

The product should help a student:

1. understand how they currently study,
2. begin with a reasonable study-technique hypothesis,
3. add real class material,
4. generate practice questions from that material,
5. review and approve those questions,
6. complete a focused study session using an assigned technique,
7. record results and feedback,
8. compare techniques over time,
9. improve the next recommendation based on actual outcomes.

### Core product principle

Calibrate does **not** diagnose or assign a fixed learning style.

Language should emphasize:

- experiments,
- starting hypotheses,
- evidence,
- results,
- trying different study techniques,
- adjusting based on what happens.

Avoid language implying that a student permanently “is” a visual learner, auditory learner, etc.

---

## 2. Core User Journey

The target end-to-end Calibrate loop is:

```text
Start / Welcome
    ↓
How It Works
    ↓
Onboarding Questions
    ↓
Starting Hypothesis
    ↓
Create / Select Subject
    ↓
Add Material
    ├─ Upload PDF (primary)
    └─ Paste Notes (secondary)
    ↓
Generate Structured Questions
    ↓
Review / Edit / Approve Questions
    ↓
Study Session
    ↓
Answer Reveal / Self-Assessment
    ↓
Post-Session Feedback
    ↓
If score/result dipped: Why?
    ↓
Insights / Technique Comparison
    ↓
Next Recommendation / Next Session
```

A useful shorthand is:

```text
Subjects → Materials → Questions → Sessions → Outcomes → Insights
```

The MVP is successful when **one complete experiment works end-to-end**.

---

## 3. Current Frontend Milestone

The immediate frontend milestone is to finish the guided first-time experience before doing another major redesign of the main application.

### Approved sequence

```text
/start
  ↓
/how-it-works
  ↓
/onboarding
  ↓
Starting Hypothesis
  ↓
Set Up First Subject
```

### Current status

- The new `/start` page has been implemented and is approved as a strong direction.
- `/start` is standalone and does not show the normal application sidebar.
- `/how-it-works` exists, but it still needs to become the richer visual **numbered progression** described below.
- The current branch for this work is:

```text
feature/start-onboarding-flow
```

- That branch is pushed to GitHub and tracks:

```text
origin/feature/start-onboarding-flow
```

- The stable/demo branch remains:

```text
shane-dev
```

### Most recent validation reported by Replit

- `npm test` — 61 tests passed
- `npm run typecheck` — passed
- `npm run build` — passed

---

## 4. Start / Welcome Screen

The Start screen should feel like opening a polished guided product or game, not like entering a dashboard.

### Purpose

Give the user one strong message and one obvious starting action.

### Current approved content direction

**Brand:** Calibrate

**Headline:**

> Stop guessing how to study.

**Supporting idea:**

> Test evidence-based techniques, track what happens, and learn what actually works for you.

### Primary actions

- **Start Calibrating** → onboarding
- **How It Works** → `/how-it-works`
- small returning-user action → dashboard

### Visual rules

- no sidebar,
- lots of whitespace,
- warm cream background,
- soft sage shapes,
- turquoise/green accents,
- charcoal text,
- Calibrate logo/mark,
- premium academic feel,
- slightly game-like sense of entering an experience.

The Start page is currently considered **good** and should not be casually redesigned while working on later steps.

---

## 5. How It Works Experience

This page should quickly teach the product in approximately 15–30 seconds.

It should use a clear numbered progression such as:

```text
1 → 2 → 3 → 4 → 5
```

Each step should have:

- a large visible number,
- short title,
- 1–2 sentence explanation,
- visual preview inspired by the actual Calibrate UI,
- obvious reading order.

### Recommended 5-step flow

#### 1 — Start with a hypothesis

Explain that the student answers a few questions about current study behavior and Calibrate chooses a reasonable technique to test first.

Visual: miniature onboarding question / answer cards.

#### 2 — Use your real class material

Explain that the student uploads a PDF or pastes notes.

Visual: material card with PDF and Paste Notes options.

#### 3 — Generate and review questions

Explain that Calibrate creates practice from the student's material and the student can approve, edit, or reject generated questions.

Visual: miniature Question Bank with statuses such as Generated, Approved, Needs Edit.

#### 4 — Run a focused study session

Explain that the student studies using a technique Calibrate assigned for the experiment.

Examples:

- Active Recall
- Feynman Technique
- Re-reading / comparison baseline if used in experiments

Visual: miniature study session with technique label, timer, question, answer area, Submit and Reveal.

#### 5 — Learn from the result

Explain that Calibrate records performance and feedback, then uses results over time to compare techniques and improve the next recommendation.

Visual: feedback card, result card, or technique comparison bars.

### Interaction

- desktop: horizontal or stepped progression is preferred,
- mobile: stack vertically while preserving obvious 1 → 2 → 3 → 4 → 5 progression,
- CTA at bottom: **Start onboarding**,
- secondary: **Back**.

### Important

This should feel like visual guidance, not a long marketing page.

---

## 6. Onboarding Experience

Onboarding should feel like the next chapter after Start and How It Works.

### Layout

- no app sidebar,
- one focused question at a time,
- clear progress indicator,
- centered layout,
- generous whitespace,
- same Calibrate visual language.

### Behavior already desired / partly implemented

- selecting an answer visibly highlights/checks it,
- answer selection does **not** auto-advance,
- user presses Next intentionally,
- Back preserves previous selections,
- required questions should not advance without an answer,
- progress should be obvious.

### “Why we ask” copy

Each question should have a short, muted explanation of why Calibrate is asking it.

Examples:

- “This helps us understand what you currently rely on while studying.”
- “This helps us choose a useful first technique to test.”
- “This helps us understand how you currently check whether studying worked.”
- “This gives Calibrate context when interpreting future session results.”

Keep these explanations short and non-technical.

### Language rules

Do not use fixed learning-style language.

The onboarding recommendation is a **starting hypothesis**, not a diagnosis.

---

## 7. Starting Hypothesis Screen

This is the completion/reveal moment of onboarding.

### Core message

The student should understand:

1. Calibrate has chosen a technique to test first.
2. This is not permanent.
3. Real study-session results can change the recommendation.
4. The next step is setting up a subject/material and running the first experiment.

### Figma-inspired structure

**Heading:**

> YOUR STARTING HYPOTHESIS

**Supporting copy:**

> Based on how you study, here’s where we’ll begin.

**Result card:**

```text
For: [Subject if available]
[Recommended Technique]
```

**Explanation:**

> This is a starting hypothesis, not a fixed label. We’ll adjust it based on what happens in your real study sessions.

### Actions

Primary:

> Set up my first subject

Secondary:

> Go to dashboard

Tertiary:

> Retake onboarding

Optional small bridge copy:

> Next: add your material and run your first experiment.

---

## 8. First-Time vs Returning User Behavior

### New user

```text
Open Calibrate
    ↓
Start
    ↓
How It Works (optional)
    ↓
Onboarding
    ↓
Starting Hypothesis
    ↓
First Subject Setup
```

### Returning user

If onboarding has already been completed:

```text
Open Calibrate
    ↓
Dashboard
```

### Later access

Onboarding should remain available as something like:

- Retake onboarding
- Update study profile

It should **not** remain one of the most prominent daily navigation tabs forever.

---

## 9. Visual Design System

The Figma screens and the implemented Calibrate onboarding/start experience are the visual source of truth.

### Core palette and feel

- warm cream / off-white background,
- soft sage panels and decorative shapes,
- turquoise/green primary actions,
- charcoal / near-black typography,
- white content cards,
- thin dark borders,
- simple rounded corners,
- generous whitespace,
- restrained decorative geometry,
- no purple StudyCoach styling,
- no unnecessary gradients or flashy “AI” visuals.

### Typography / hierarchy

- large simple page titles,
- strong visual hierarchy,
- minimal text,
- large obvious CTAs,
- compact muted helper text,
- avoid clutter.

### Status language seen in Figma / desired product behavior

- Generated
- Approved
- Needs Edit
- Flagged
- Timed

### Important cohesion rule

All later Calibrate pages should look like they belong to the same product as the Start / onboarding flow.

The product may have two layout modes:

#### Focused / guided mode

No sidebar:

- Start
- How It Works
- Onboarding
- Starting Hypothesis
- focused study screens when appropriate

#### Main application mode

Sidebar/app shell:

- Dashboard
- Study Session
- Question Bank
- Insights / Compare
- Subjects
- Settings/Profile

---

## 10. Figma Product Concepts to Preserve

The shared Figma screens include useful product concepts that should inform future implementation.

### Study session screens

Examples shown:

- Re-reading session with timer and “Done reading”
- Active Recall question with timed response and “Submit and reveal”
- Feynman Technique prompt with explanation box
- correct / incorrect reveal states

### Post-session feedback

Example:

> How’d it go?

with options like:

- Rough
- Good

plus an anxiety/calm → wired slider.

### Score dip explanation

Example prompt:

> Score dipped today — what happened?

Select all that apply:

- Technique was wrong
- Questions weren’t right
- Material was hard
- Distracted / Low energy

This is important because a low result should **not automatically mean the study technique failed**.

### Question Bank

Figma concepts include:

- generated questions,
- approved questions,
- needs-edit questions,
- Edit,
- Regenerate,
- Approve All Remaining,
- source-aware review.

### Technique Comparison

Figma concept includes technique comparison bars and a recommendation such as:

> Use Feynman going forward

This should eventually be driven by real experiment data rather than synthetic demo numbers.

---

## 11. Main App Navigation — Future Direction

The exact final tab names can still evolve, but the long-term structure should probably resemble:

```text
Dashboard
Study Session
Question Bank
Insights
Subjects
Settings / Profile
```

### Important

Do not blindly preserve older Figma labels such as `History`, `Compare`, or old numbered onboarding navigation if newer product structure is clearer.

The Figma is the **visual and interaction source of truth**, not necessarily the final information architecture word-for-word.

---

## 12. Current Technical Foundation

The current project is based on the mentor starter repository and has been evolved into Calibrate.

### Stack

- Next.js 14.2.35 App Router
- React
- TypeScript
- Tailwind
- SQLite via `better-sqlite3`
- Drizzle ORM
- Vitest

### Existing API route families

Examples include:

- `/api/materials`
- `/api/questions`
- `/api/questions/generate`
- `/api/subjects`
- `/api/sessions`
- `/api/outcomes`
- `/api/onboarding`
- `/api/insights`
- `/api/feedback`

There are also `[id]` routes and ownership / isolation protections.

### Existing LLM/provider architecture

The starter includes a provider abstraction with examples such as:

- mock,
- Ollama,
- OpenAI-compatible provider.

This may be adapted later to call Shreya’s FastAPI service.

---

## 13. Development Environment Notes

### Node

The project worked reliably with Node 22 locally after Node 26 caused issues.

Useful setup:

```bash
npm ci
npm run setup
npm test
npm run typecheck
```

### `.next` cache issue

Replit previously hit stale build output such as:

```text
Cannot find module './276.js'
```

Typical fix:

```bash
rm -rf .next
npm run dev
```

A post-merge script was updated to clear `.next` before building.

---

## 14. Git / Branch Workflow

### Important branches

- `main` — team main branch
- `shane-dev` — Shane’s current stable/demo work
- `feature/start-onboarding-flow` — current frontend milestone
- `calibrate-question-bank` — earlier question-bank feature branch

### Current rule

Do active work on focused feature branches, then merge into `shane-dev` after testing.

Do not casually force-push or rewrite shared history.

### Typical workflow

```bash
git checkout shane-dev
git pull origin shane-dev
git checkout -b feature/example
```

Push:

```bash
git push -u origin feature/example
```

After work is tested:

```bash
git checkout shane-dev
git pull origin shane-dev
git merge feature/example
git push origin shane-dev
```

---

## 15. Question Bank — Current Product Direction

The Question Bank is where generated practice becomes trustworthy, student-controlled study content.

### Important product rule

AI-generated questions should **not automatically become trusted experiment data**.

A student should be able to review generated questions first.

Suggested statuses:

```text
generated
edited
approved
rejected
flagged
```

Only approved questions should be used in official study sessions when practical.

### Existing Question Bank capabilities already developed

The project has work around:

- subject selector,
- question count,
- material title,
- paste-notes workflow,
- generated questions,
- saved questions,
- source material display,
- filtering,
- delete behavior,
- ownership protection,
- orphan prevention,
- validation.

The next major Question Bank redesign should wait until the Shreya ML contract is finalized.

---

## 16. Subjects and Materials

Current real/test subjects from Shreya’s work:

- Chicano Studies
- Statistics
- Neuroscience
- Literature

Example source files previously used:

- `CHI 10 - Lecture Notes - Google Docs.pdf`
- `Copy of Chapter 5 and 6.pdf`
- `Copy of Study Guide for Neurosci test .pdf`
- `odyssey_notes_hum_1.pdf`

The seeded Calibrate dataset was updated away from the mentor placeholder subjects.

### Material source abstraction

Both should exist:

- **PDF upload** — primary workflow
- **Paste Notes** — secondary workflow

Both should eventually become a common `Material` source that can feed the same generation pipeline.

---

## 17. Shreya’s ML / Python Pipeline

Shreya is responsible for the ML/question-generation side.

### Her general ownership

- PDF parsing / extraction quality
- token counting
- model and prompt experimentation
- structured question generation
- evaluation harness
- grounding / quality checks
- model comparison
- hallucination testing

### Python indicators

The work has included Python files such as:

- `pdf_parser.py`
- `llm_question_generation.py`
- evaluation scripts

So “iterating in Python” means she modifies those scripts, reruns them, compares outputs, and improves the pipeline.

### PDF parsing

Previously discussed parser behavior:

- uses `pdfplumber`
- supports typed PDFs
- extracts text and metadata
- calculates word count / approximate token count
- does not yet provide OCR for scanned-image PDFs

### Proposed material token cap

Approximately:

```text
6,000 tokens
```

This should apply to both PDF extraction and pasted notes.

The exact final cap can still be adjusted after testing.

---

## 18. Structured Question Format

Shreya’s newer pipeline should return structured question data rather than plain question strings.

Conceptual format:

```json
{
  "type": "mcq",
  "question": "...",
  "answer": "...",
  "answer_choices": ["...", "...", "...", "..."],
  "source_excerpt": "..."
}
```

For non-MCQ questions:

```json
{
  "type": "active_recall",
  "question": "...",
  "answer": "...",
  "answer_choices": [],
  "source_excerpt": "..."
}
```

### Expected question types

Current examples include:

- `active_recall`
- `mcq`
- `feynman`
- `fill_in_blank`

### Future stored fields may include

- type
- question / prompt
- answer
- answerChoices
- sourceExcerpt / supportingContext
- status
- subjectId
- materialId
- source/material metadata

### Important validation

- MCQ correct answer must match one of the answer choices.
- Generated questions should include an answer or useful scoring guide.
- Invalid/malformed model output should not be silently stored.

---

## 19. FastAPI Integration Plan

The clean team architecture is:

```text
Student Browser
    ↓
Calibrate Next.js app
    ↓
Next.js API route
    ↓
Shreya FastAPI ML service
    ↓
Python parser / token check / question generator
    ↓
LLM
    ↓
Structured JSON
    ↓
Next.js validation + database
    ↓
Question Bank / Study Session
```

### Plain-language analogy

- Calibrate frontend = what the student sees
- Next.js backend = the front desk / coordinator
- FastAPI = the bridge/order window
- Shreya’s Python pipeline = the engine/kitchen
- LLM = one tool used inside the engine

### Browser should not call the model directly

Preferred pattern:

```text
Browser → Next.js → FastAPI → LLM
```

This keeps secrets, validation, user ownership, and database writes on the server side.

### Possible FastAPI endpoints

- `POST /parse-pdf`
- `POST /count-tokens`
- `POST /generate-questions`
- `GET /health`

Evaluation endpoints should usually remain internal/dev rather than part of the normal student generation flow.

---

## 20. Proposed API Contract Between Shane and Shreya

The exact contract should be agreed on before major PDF / Question Bank redesign.

### Example request

```json
{
  "subject": "Neuroscience",
  "text": "...",
  "requestedQuestionCount": 6,
  "materialId": "optional-correlation-id",
  "fileName": "notes.pdf",
  "wordCount": 1614,
  "tokenCount": 1776,
  "dateUploaded": "2026-08-06"
}
```

### Example response

```json
{
  "questions": [
    {
      "type": "active_recall",
      "question": "...",
      "answer": "...",
      "answer_choices": [],
      "source_excerpt": "..."
    }
  ]
}
```

### Example error

```json
{
  "success": false,
  "code": "NOTES_TOO_LONG",
  "message": "Notes must be below 6,000 tokens."
}
```

### Errors that should eventually be handled clearly

- notes too long,
- unsupported/scanned PDF,
- malformed generated JSON,
- model timeout,
- fewer generated questions than requested,
- missing answers,
- invalid MCQ choices,
- service unavailable.

---

## 21. Team Responsibility Split

### Shane — Product / Integration Engineer

Owns:

- frontend UX
- Next.js integration
- upload experience
- subjects/materials/questions database behavior
- question review UI
- study session rendering
- error states
- outcomes and insights UX
- Git/GitHub workflow
- deployment/infrastructure integration
- contract between the product and ML service

### Shreya — ML / Evaluation Engineer

Owns:

- PDF extraction
- token counting
- generation prompts/models
- structured output generation
- evaluation harness
- question quality testing
- model comparison
- grounding/hallucination checks

### Shared ownership

- request/response contract
- token limits
- model selection
- quality acceptance criteria
- human approval workflow
- production testing

---

## 22. ML Model Strategy

Do not switch models impulsively just because a different model is newer or more popular.

Use Shreya’s current working baseline as the integration baseline first.

Then compare candidate models on the **same fixed evaluation set**.

Choose based on:

- groundedness,
- correctness,
- structured JSON reliability,
- latency,
- cost,
- manual review quality.

LLM-as-judge can help with evaluation, but should be manually spot-checked and should not be treated as absolute proof of quality.

---

## 23. Study Session Product Direction

Study Session should render different question types appropriately.

### MCQ

- selectable choices,
- submit,
- reveal correct answer / explanation.

### Active Recall

- free-response input,
- reveal answer,
- self-assess or score appropriately.

### Fill in the Blank

- direct input,
- reveal / score.

### Feynman Technique

- explain in the student’s own words,
- compare against answer/key concepts,
- may use rubric / supporting points rather than a single exact answer.

### Figma interaction style

- large focused question,
- technique label,
- timed badge where relevant,
- obvious answer area,
- large “Submit and reveal” CTA,
- simple result state.

---

## 24. Feedback and Recommendation Loop

A poor score should not automatically mean “the technique was bad.”

If performance dips, Calibrate should ask why.

Possible one-tap reasons:

- Technique was wrong
- Questions weren’t right
- Material was hard
- Distracted / Low energy

This prevents the recommendation engine from misinterpreting bad questions, difficult content, or low energy as evidence against a technique.

### Recommendation principle

For MVP, the actual recommendation should be selected using transparent deterministic/statistical logic.

An LLM may later explain the result in friendly language, but it should not secretly decide the recommendation without transparent logic.

---

## 25. Insights / Technique Comparison

Insights should eventually answer questions such as:

- Which technique appears strongest for this student?
- How many sessions support that conclusion?
- Is there enough data yet?
- How did recent sessions perform?
- What should the student test next?

Figma shows comparison bars for techniques such as:

- Feynman
- Active Recall
- Re-read

Do not imply a conclusion is statistically meaningful when there are too few sessions.

Useful language:

> Keep logging sessions to get more conclusive data.

---

## 26. Dashboard Direction

The current dashboard exists and has already received some Calibrate visual styling, but parts may still use synthetic/demo data.

The future dashboard should become the student’s “what should I do next?” page.

Potential content:

- current recommended technique / experiment,
- next session CTA,
- recent session performance,
- subject progress,
- questions ready for review,
- technique comparison / evidence status,
- streak only if it supports the product rather than distracting from it.

Do not overbuild the dashboard before the real workflow is connected.

---

## 27. Product Scope Guardrails

Do **not** overbuild v1.

Avoid adding prematurely:

- vector database / RAG unless material size truly requires it,
- complex autonomous agents,
- native mobile app,
- heavy gamification,
- payments,
- complicated social features,
- elaborate OCR pipeline unless required,
- unnecessary auth complexity before the core loop works.

### First prove

```text
assignment
→ material
→ generation
→ review
→ study
→ feedback
→ next recommendation
```

---

## 28. Production / Infrastructure Direction

Later production direction may be:

- Next.js frontend/API → Vercel or equivalent
- Postgres/Supabase → production database/auth/storage
- FastAPI ML service → Render / Railway / Fly / Cloud Run or similar
- GitHub → source of truth
- Replit → fast prototyping
- Cursor → deeper implementation/refactor/review

SQLite is acceptable for local/Replit demo work but should not be the long-term multi-user production database.

### CI target

For JavaScript/TypeScript:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

For Python ML service later:

- install requirements
- run `pytest`
- optionally lint with `ruff`

---

## 29. Pilot / Research Direction

When the end-to-end loop works:

1. internal team testing,
2. small student pilot,
3. compare multiple techniques within the same subject where possible,
4. avoid drawing conclusions from cross-subject differences alone,
5. collect qualitative feedback on question quality and study usability,
6. expand only after the core loop is reliable.

---

## 30. Guidance for AI Engineer Mentor / ChatGPT

When helping Shane with Calibrate:

### Communication style

- Explain things in plain language by default.
- Shane understands frontend and basic backend concepts but does not want every answer buried in jargon.
- Start high-level, then add technical detail only when it helps the next decision.
- Use analogies when architecture is confusing.
- Be concise when the question is simple.
- Be detailed when writing implementation prompts, architecture plans, or debugging steps.

### Replit prompts

When giving a Replit Agent prompt, make it high quality and production-minded.

A strong prompt should include:

1. milestone/context,
2. explicit goal,
3. what may change,
4. what must not change,
5. visual/design requirements,
6. behavior/routing requirements,
7. accessibility/responsiveness expectations,
8. data/API constraints,
9. validation commands,
10. final requested summary of files changed.

Do not give vague prompts such as “make this page better.”

### Product consistency

Before suggesting major changes, check them against:

- the core product loop,
- the Figma direction,
- the current ML contract,
- the human question-review requirement,
- the current milestone.

### Sequencing rule

Do not redesign everything at once.

Preferred sequence:

```text
Finish first-time frontend flow
→ lock ML/API contract with Shreya
→ connect materials/question generation
→ rebuild Question Bank around real structured data
→ rebuild Study Session
→ connect outcomes/feedback
→ rebuild Dashboard/Insights around real data
→ production hardening
```

### Source-of-truth behavior

Treat this document as the current Calibrate source of truth unless Shane explicitly changes a decision.

If a later instruction conflicts with this file, the later explicit user instruction wins and this file should eventually be updated.

---

## 31. Guidance for Replit Agent

Replit Agent should:

- read `replit.md` first,
- use this file for deeper context when a task affects product architecture or workflow,
- preserve existing APIs/database behavior unless the prompt explicitly allows changes,
- avoid broad rewrites,
- avoid altering unrelated pages during scoped tasks,
- use Figma/Calibrate styling rather than old StudyCoach purple styling,
- run tests/typecheck/build after meaningful frontend/backend changes,
- clearly report files changed and any assumptions made,
- stop and explain before making a major schema change that was not explicitly requested.

---

## 32. Current Immediate Plan

The next implementation sequence is:

```text
1. Keep approved Start page
2. Rebuild How It Works into numbered 1–5 visual panels
3. Refine onboarding questions and progress behavior
4. Refine Starting Hypothesis completion screen
5. Add correct first-time vs returning-user routing
6. Review the entire first-time journey
7. Then move to Shreya ML/FastAPI integration
```

Do not begin another broad Dashboard / Question Bank / Study Session redesign until the first-time flow is reviewed and the ML contract is aligned.

---

## 33. One-Sentence Product Test

When unsure whether a feature belongs in Calibrate, ask:

> Does this help a student run a clearer study experiment and learn from the result?

If the answer is no, it is probably not an MVP priority.
