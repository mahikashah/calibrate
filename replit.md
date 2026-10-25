# Calibrate

Calibrate is an evidence-based AI study coach that helps students test different study techniques, track what happens, and learn what actually works for them through experimentation.

The product must NOT assign students fixed learning-style labels.

## Current Architecture

- Next.js 14 App Router
- React
- TypeScript
- Tailwind CSS
- SQLite for the current local/demo environment
- Drizzle ORM
- Vitest tests
- Existing Next.js API routes handle Calibrate application behavior
- A Python/FastAPI ML service will later connect Shreya's question-generation pipeline to the web app

Preserve the existing architecture unless a change is explicitly required.

## Detailed Product Context

For substantial Calibrate product, UX, architecture, onboarding, Question Bank, Study Session, ML integration, navigation, or recommendation work, read:

`docs/CALIBRATE_MASTER_CONTEXT.md`

Treat that document as the detailed product source of truth.

If a requested change appears to conflict with that document, do not silently invent a new direction. Call out the conflict before making a large architectural or product change.

## Core Product Loop

The intended Calibrate experience is:

Start
→ How It Works
→ Onboarding
→ Starting Hypothesis
→ Create Subject
→ Add Material
→ Generate Questions
→ Review / Edit / Approve Questions
→ Study Session
→ Post-session Feedback
→ Insights / Technique Comparison
→ Next Recommendation

The goal is to help students run small study experiments and gradually determine which techniques work best for them.

## Current Frontend Milestone

We are currently focused on completing the first-time user journey:

`/start`
→ `/how-it-works`
→ `/onboarding`
→ Starting Hypothesis
→ first subject setup

The approved `/start` page should remain largely unchanged unless a specific bug or consistency issue requires a small adjustment.

The next major frontend tasks are:

1. Build a clear 1 → 2 → 3 → 4 → 5 visual How It Works walkthrough.
2. Refine the onboarding question experience.
3. Refine the Starting Hypothesis reveal.
4. Add correct first-time vs returning-user routing.

Do not redesign Dashboard, Question Bank, Study Session, Insights, or Subjects during this milestone unless explicitly requested.

## First-Time Experience Rules

The first-time experience should feel focused and guided, almost like progressing through a simple game or experiment setup.

These routes should NOT show the normal Calibrate application sidebar:

- `/start`
- `/how-it-works`
- `/onboarding`
- Starting Hypothesis screen/state

The normal Calibrate app should use the application shell/sidebar after onboarding.

## Calibrate Visual Language

Treat the existing Calibrate Figma designs and approved frontend work as the visual source of truth.

Use:

- warm cream / off-white backgrounds
- sage accents
- muted turquoise / green primary actions
- charcoal / near-black text
- white cards where useful
- thin dark borders
- generous whitespace
- simple large headings
- focused layouts
- restrained decorative circles/shapes
- clear selected, approved, edit, warning, and success states

Avoid:

- purple StudyCoach styling
- generic SaaS dashboard styling
- excessive gradients
- overly dense interfaces
- redesigning established screens without a clear reason

All pages should feel like parts of the same Calibrate product.

## Onboarding Rules

Onboarding is used to create a starting hypothesis, not diagnose a fixed learning style.

Preserve existing onboarding logic unless explicitly asked to modify it.

Behavior should include:

- one focused question at a time
- visible progress
- selecting an answer visibly highlights/checks it
- selecting an answer does not automatically advance
- Next advances intentionally
- Back preserves previous selections
- short "why we ask this" explanations
- no learning-style claims

The final recommendation must be described as a starting hypothesis that can change based on real study-session results.

## Question Generation / ML Boundary

Shreya owns the Python ML/question-generation pipeline.

Her pipeline is responsible for things such as:

- parsing PDF text
- accepting pasted notes
- token counting / upload limits
- prompting the LLM
- generating structured questions
- returning answers
- returning answer choices when appropriate
- returning supporting/source excerpts
- ML evaluation and quality testing

The Calibrate Next.js application is responsible for:

- student-facing upload UI
- subjects and materials
- user/data ownership
- calling the ML backend
- validating returned data
- storing questions
- Question Bank review
- approving/editing/rejecting questions
- Study Session rendering
- outcomes
- feedback
- insights
- recommendations

The planned architecture is conceptually:

Browser
→ Next.js API
→ FastAPI ML service
→ LLM
→ FastAPI
→ Next.js
→ Database / UI

Do not expose model API keys directly to the browser.

## Structured Question Direction

Generated questions should be treated as structured data rather than plain strings.

Expect fields conceptually similar to:

- `type`
- `question`
- `answer`
- `answerChoices`
- `sourceExcerpt` or supporting context
- `subjectId`
- `materialId`
- `status`

Possible question types include:

- active recall
- multiple choice
- Feynman
- fill in the blank

Question status may eventually include:

- generated
- edited
- approved
- rejected
- flagged

Do not redesign Question Bank or Study Session in a way that conflicts with this structured format.

## Human Review Principle

AI-generated questions should go through student review before they are used as trusted experiment data.

The student should be able to:

- approve
- edit
- reject
- regenerate where appropriate

Only approved questions should eventually be used for study sessions that affect meaningful technique comparisons.

This prevents poor AI-generated questions from being mistaken for evidence that a study technique failed.

## Study Experiment Principle

Calibrate should separate different reasons a session may go poorly.

A poor result does not automatically mean the study technique was bad.

Possible explanations may include:

- technique was wrong
- questions were not right
- material was difficult
- distracted / low energy

This feedback should help Calibrate interpret future results more carefully.

## Recommendation Philosophy

For the MVP, recommendation choice should remain transparent and explainable.

Prefer deterministic / rule-based / statistical recommendation logic over letting an LLM silently decide everything.

An LLM may later help explain a recommendation, but it should not be the opaque source of truth for the recommendation itself.

## Engineering Rules

When making changes:

1. Read relevant existing code before changing architecture.
2. Make the smallest safe change that satisfies the task.
3. Preserve existing APIs and database behavior unless explicitly asked to change them.
4. Do not modify unrelated pages during a scoped frontend task.
5. Do not introduce authentication, payments, RAG, vector databases, or other major infrastructure unless explicitly requested.
6. Do not expose secrets to browser code.
7. Preserve current user/data ownership safeguards.
8. Prefer reusable Calibrate components over duplicated page-specific implementations.
9. Avoid large rewrites when an incremental change will work.
10. Explain major architectural conflicts before implementing them.

## Validation

After meaningful application changes, run:

`npm test`

`npm run typecheck`

`npm run build`

If a command fails, investigate the actual cause rather than hiding or bypassing the failure.

For frontend work, also manually verify:

- expected route behavior
- desktop layout
- mobile/responsive behavior
- sidebar visibility rules
- no accidental regressions to unrelated routes

## Git / Branch Safety

Current development commonly uses:

- `main` — team/mainline history
- `shane-dev` — Shane's stable/current demo branch
- feature branches for scoped work

The current frontend milestone is being developed on:

`feature/start-onboarding-flow`

Do not merge or rewrite shared branch history unless explicitly requested.

Prefer scoped commits with clear messages.

## User Preferences

- Explain technical concepts in plain language first.
- Give high-quality implementation prompts with clear scope.
- Replit prompts should include:
  - goal
  - scope
  - explicit things not to change
  - design requirements
  - behavior/routing
  - validation steps
  - completion summary
- Do not overcomplicate explanations unless deeper technical detail is requested.
- Treat Figma and approved Calibrate screens as the visual reference.
- Keep all tabs/pages visually cohesive.
- Preserve product decisions already documented unless there is a strong reason to change them.

## Current Priority

Finish the first-time frontend flow before moving into broad dashboard redesign or ML integration:

Start
→ How It Works
→ Onboarding
→ Starting Hypothesis
→ First Subject

After that milestone is reviewed, move into connecting Shreya's ML pipeline and then update the core application pages around real structured data.