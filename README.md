# Calibrate
Calibrate is an AI-assisted study coach that helps students discover **which evidence-based study techniques work best for them** through repeated practice and measurable outcomes — not fixed “learning style” labels.
The core loop is:
**Material → AI-generated questions → Review/approve → Study technique → Outcome check → Evidence → Insights**
AI is used narrowly to turn a student’s own notes or text-based PDFs into grounded practice questions. Calibrate’s recommendation logic is deterministic and transparent: the model does **not** decide which study technique “wins.” Recommendations come from the student’s recorded outcome evidence.
---
## Current MVP
The current version includes:
- Behavioral onboarding and a starting study-technique hypothesis
- Subject and study-material management
- Pasted-note and text-based PDF ingestion
- AI question generation through FastAPI + Hugging Face/Qwen
- Explicit deterministic demo generation mode
- Question review workflow: Generated → Edited → Approved / Rejected
- Question Bank filtering by subject, material, type, and review state
- Question Bank pagination
- Configurable question-generation target from 1–10 questions
- Approved-question-only Study sessions
- Technique guidance for Active Recall, Practice Questions, Feynman / Self-Explanation, Spaced Repetition, and Re-reading where applicable
- Outcome-backed study sessions
- Session feedback
- Dashboard and Insights views
- Separation of real evidence from seeded/demo evidence
> **Important:** Calibrate is currently a single-user MVP/demo application. Authentication, user accounts, and production-grade multi-user persistence are future work.
---
# Architecture
```text
Browser
   |
   v
Next.js 14 App Router
   |
   |-- SQLite + Drizzle ORM
   |
   |-- Question/subject/session/outcome APIs
   |
   `-- Question generation request
           |
           v
      FastAPI ML service
           |
           v
      Hugging Face Inference
           |
           v
      Qwen model
```
### Main stack
- **Next.js 14**
- **React**
- **TypeScript**
- **Tailwind CSS**
- **SQLite**
- **better-sqlite3**
- **Drizzle ORM**
- **FastAPI**
- **Python 3.11**
- **Hugging Face Inference Providers**
- **Qwen/Qwen2.5-7B-Instruct** as the current baseline model
- **Vitest**
- **pytest**
---
# Product Flow
## 1. First-time setup
The intended first-time flow is:
```text
/start
  ↓
/how-it-works
  ↓
/onboarding
  ↓
Starting Hypothesis
  ↓
Create/select first subject
```
Onboarding forms a **starting hypothesis**, not a permanent learning-style label.
The hypothesis is meant to be tested against later study evidence.
---
## 2. Subjects and materials
Use **Subjects** to organize course content.
A subject can contain study materials created from:
- pasted notes
- text-based PDF files
Typical flow:
```text
Subjects
  ↓
Select/Create Subject
  ↓
Add material
  ↓
Paste notes OR upload PDF
  ↓
Choose question target
  ↓
Generate questions
```
### PDF limitation
Calibrate currently supports **text-based PDFs**.
Scanned/image-only PDFs are not supported because OCR is not part of the current MVP.
---
## 3. Question generation
Calibrate supports a requested generation target of:
- Minimum: **1**
- Maximum: **10**
- Default target: **6**
The number is a **target**, not a quota.
If a student requests 8 questions but the material only supports 5 distinct, grounded questions, Calibrate may return 5 rather than inventing or duplicating content.
Generation flow:
```text
Material
  ↓
Next.js generation API
  ↓
FastAPI
  ↓
Hugging Face / Qwen
  ↓
Structured questions
  ↓
Persist to SQLite
  ↓
Question Bank review
```
Supported structured question types include:
- Active Recall
- Multiple Choice
- Feynman / Self-Explanation
- Fill in the Blank
---
## 4. Question Bank
The Question Bank is the review gate between AI generation and Study.
Generated questions are **not automatically trusted**.
Question lifecycle:
```text
Generated
   ↓
Edit if needed
   ↓
Approved OR Rejected
```
Only **Approved** questions are eligible for real Study sessions.
### Question Bank filters
Saved questions can be filtered by:
- Subject
- Material
- Question type
- Review state
A **Clear filters** action returns the view to the complete Question Bank.
### Pagination
Question Bank filtering happens before pagination.
The current page size is **12 questions**.
Example:
```text
48 total questions
Showing 1–12 of 48
Page 1 of 4
```
All saved questions remain reachable through Previous / Next pagination.
### Generation handoff
After generation:
```text
Questions ready
   ↓
Review questions
   ↓
Exact subject/material batch
   ↓
Ready for review
   ↓
Edit / Approve / Reject
```
The generation handoff carries subject/material context and immediately loads the newly generated batch.
---
# Study and the Evidence Loop
Calibrate is not intended to be a glorified study timer.
The important distinction is:
```text
Study duration = supporting context
Learning outcome = evidence
```
The core evidence loop is:
```text
Approved Questions
      ↓
Choose Study Technique
      ↓
Complete Study Session
      ↓
Outcome Check
      ↓
Evidence Record
      ↓
Insights / Recommendation
```
## Study techniques
The Study page includes concise guidance explaining how to perform the selected technique.
Current guidance covers the techniques available in the project, including:
### Active Recall
Retrieve information from memory before checking the answer or notes.
### Practice Questions
Answer approved questions without assistance, then check performance.
### Feynman / Self-Explanation
Explain a concept in your own words and compare it with the reference material.
The current MVP uses self-check behavior; it does **not** provide sophisticated automatic essay grading.
### Spaced Repetition
Revisit material and test retention.
The current MVP does **not** yet include a full spaced-repetition scheduling engine such as SM-2.
### Re-reading
Review the material and then complete an outcome check.
Calibrate compares the resulting outcome — **not simply the amount of time spent reading**.
---
# Outcomes and Insights
Completed Study sessions create evidence associated with:
- Subject
- Study technique
- Outcome/performance
- Session duration as supporting context
- Session feedback
- Evidence origin (`real` or `demo`)
The deterministic recommendation system compares outcome evidence by subject and technique.
AI does **not** choose the strongest technique.
## Evidence origins
Calibrate distinguishes:
```text
real = genuine sessions completed through the real Study flow
demo = seeded/example/presentation evidence
```
Real recommendations exclude demo evidence.
This allows the app to contain mature presentation data without treating it as the current user’s genuine learning history.
---
# Main Pages
## `/start`
First-time welcome screen.
Purpose:
- introduce Calibrate
- start onboarding
## `/how-it-works`
Explains the core product idea before onboarding.
## `/onboarding`
Behavioral onboarding.
Purpose:
- understand current study habits
- form a starting hypothesis
- avoid fixed learning-style labeling
## `/dashboard`
Main application home.
Shows high-level state such as:
- current recommendation
- evidence progress
- recent session
- subject shortcuts
- next recommended action
Dashboard and Insights use shared deterministic recommendation logic.
## `/subjects`
Manage subjects and access their study materials.
Typical actions:
- create/select subject
- view subject materials
- add study material
## `/subjects/[subjectId]/materials/new`
Material intake and generation screen.
Supports:
- pasted notes
- text-based PDF upload
- question target selection
- AI question generation
## `/questions`
Question Bank.
Purpose:
- browse saved questions
- filter by subject/material/type/status
- paginate through all saved questions
- generate from pasted notes
- review newly generated batches
- edit questions
- approve questions
- reject questions
- send approved questions into Study
## `/study`
Study setup and study-session entry point.
Purpose:
- choose subject/material context
- select a study technique
- understand how to perform that technique
- verify approved questions are available
- begin an outcome-backed study session
When entered from Question Bank, subject/material context can be carried forward automatically.
## Study completion / feedback
After a session, Calibrate records outcome evidence and routes through the session-feedback flow.
Feedback is supporting context and does not independently decide the winning technique.
## `/insights`
Shows what the student’s evidence suggests so far.
Insights are based on completed, outcome-checked sessions.
The page communicates:
- technique performance
- number of evidence sessions
- strongest result so far
- insufficient-evidence states
- real vs example/demo data
---
# Local Development Setup
## Requirements
Recommended:
- **Node.js 20 or 22**
- Node.js 18.17+ minimum for the current Next.js version
- **Python 3.11**
- npm
- Git
On macOS with Homebrew:
```bash
brew install python@3.11
```
---
# 1. Clone and install
```bash
git clone https://github.com/mahikashah/calibrate.git
cd calibrate
npm install
```
If you are working from the current development branch:
```bash
git checkout shane-dev
git pull --ff-only origin shane-dev
```
---
# 2. Configure the database
Run migrations:
```bash
npm run db:migrate
```
To load the seeded presentation dataset:
```bash
npm run db:seed
```
If your local scripts support the full setup shortcut:
```bash
npm run setup
```
For a clean database without seeded demo history, use migrations without the seed step.
> The current demo database can include mature example history so Dashboard and Insights are immediately demonstrable.
---
# 3. Configure Next.js environment variables
Create a root file:
```text
.env.local
```
Example:
```env
ML_SERVICE_URL=http://127.0.0.1:8000
ML_SERVICE_API_KEY=replace_with_a_shared_local_secret
CALIBRATE_DEMO_MODE=false
```
### `CALIBRATE_DEMO_MODE`
```env
CALIBRATE_DEMO_MODE=false
```
Uses the real generation architecture:
```text
Next.js → FastAPI → Hugging Face/Qwen
```
```env
CALIBRATE_DEMO_MODE=true
```
Uses Calibrate’s explicit deterministic demo generator.
Demo mode is intended for reliable demonstrations and development when live inference is unnecessary.
There is **no silent fallback** from failed real AI to demo mode.
---
# 4. Configure the FastAPI / Hugging Face environment
Create:
```text
ml-service/.env
```
Example:
```env
HF_TOKEN=replace_with_your_hugging_face_token
ML_SERVICE_API_KEY=replace_with_the_same_shared_local_secret
```
Optional configuration may include values such as:
```env
HF_MODEL=Qwen/Qwen2.5-7B-Instruct
GENERATION_TIMEOUT_SECONDS=90
WORD_LIMIT=4600
```
Use the values supported by the current ML-service configuration.
### Important
The `ML_SERVICE_API_KEY` in:
```text
.env.local
```
and:
```text
ml-service/.env
```
must match.
Do not commit either environment file.
Both are intentionally ignored by Git.
---
# 5. Create the Python environment
From the repository root:
```bash
python3.11 -m venv .venv
source .venv/bin/activate
```
Install the FastAPI service dependencies:
```bash
pip install -r ml-service/requirements.txt
```
---
# 6. Start the FastAPI AI service
From the repository root:
```bash
source .venv/bin/activate
PYTHONPATH=ml-service python -m uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000
```
This is the **Uvicorn** process that serves Calibrate’s local ML/FastAPI API.
Keep this terminal running.
### Verify FastAPI
From another terminal:
```bash
curl http://127.0.0.1:8000/health
```
Expected:
```json
{"ok":true}
```
If this health check fails, real AI generation will not work locally.
---
# 7. Start Next.js
Open a second terminal in the repository root:
```bash
npm run dev
```
Then open:
```text
http://localhost:3000
```
Normal local development therefore uses two long-running terminals:
```text
Terminal 1
npm run dev
Terminal 2
FastAPI / Uvicorn on port 8000
```
---
# Real AI Mode
For real AI generation:
### `.env.local`
```env
ML_SERVICE_URL=http://127.0.0.1:8000
ML_SERVICE_API_KEY=your_shared_secret
CALIBRATE_DEMO_MODE=false
```
### `ml-service/.env`
```env
HF_TOKEN=your_hugging_face_token
ML_SERVICE_API_KEY=your_shared_secret
```
Then start FastAPI and Next.js.
Test:
```bash
curl http://127.0.0.1:8000/health
```
After that, generate questions from the browser.
---
# Demo Mode
For deterministic presentation generation:
```env
CALIBRATE_DEMO_MODE=true
```
Restart Next.js after changing the environment variable.
Demo mode:
- does not pretend to be live AI
- produces deterministic structured questions
- uses the same persistence/review/study workflow
- is useful when network/provider reliability matters during a presentation
Do not silently present demo-mode generation as live Hugging Face inference.
---
# Hugging Face Token Notes
A real HF token is needed for live Hugging Face inference.
Do not:
- commit the token
- paste it into source code
- put it into README examples
- expose it to the browser
The token belongs only in server-side environment configuration such as:
```text
ml-service/.env
```
locally or deployment secrets in a hosted environment.
---
# Common Local Troubleshooting
## FastAPI health works but generation returns 502
This usually means Next.js successfully reached FastAPI, but FastAPI had an upstream inference/provider problem.
Check:
- `HF_TOKEN` exists
- `ml-service/.env` is saved to disk
- FastAPI was restarted after changing `.env`
- the token has appropriate Hugging Face inference access
- the configured model/provider is available
Check without printing the secret:
```bash
grep -q '^HF_TOKEN=' ml-service/.env \
  && echo "HF_TOKEN found" \
  || echo "HF_TOKEN missing"
```
Load the environment into a shell if testing manually:
```bash
set -a
source ml-service/.env
set +a
echo ${#HF_TOKEN}
```
A nonzero value means the shell received the token.
## `ml-service/.env` appears correct in the editor but shell says missing
Make sure the file is saved.
Check:
```bash
ls -l ml-service/.env
file ml-service/.env
```
A `0` byte file means the editor content has not been written to disk.
## SQLite errors such as missing columns/tables
Run:
```bash
npm run db:migrate
```
Then restart Next.js if needed.
## Stale Next.js development artifacts
If the dev server is showing stale chunk/runtime behavior:
```bash
rm -rf .next
npm run dev
```
---
# Testing
## Web application
Run unit/regression tests:
```bash
npm test
```
Type-check:
```bash
npm run typecheck
```
Production build:
```bash
npm run build
```
At the current deployment candidate, these suites should pass before merging/deploying.
## FastAPI
Activate the Python environment:
```bash
source .venv/bin/activate
```
Then:
```bash
cd ml-service
pytest tests
```
Return to the repository root afterward:
```bash
cd ..
```
---
# Recommended Demo Walkthrough
For a short product demonstration:
1. Open Dashboard briefly to show the mature example state.
2. Go to Subjects.
3. Create/select a subject.
4. Add study material.
5. Paste notes or upload a text-based PDF.
6. Choose a question target such as 6 or 8.
7. Generate questions.
8. Click **Review questions**.
9. Show the newly generated Question Bank batch.
10. Edit/approve/reject at least one question.
11. Approve enough questions for Study.
12. Click **Study approved questions**.
13. Choose a technique such as Active Recall or Feynman.
14. Open **How to do it**.
15. Complete the question-based session.
16. Show the session outcome/evidence explanation.
17. Continue through session feedback.
18. Open Insights.
19. Explain that repeated outcome-checked sessions create the evidence used to compare techniques.
Core explanation:
> Calibrate does not recommend a study technique because an AI model thinks it sounds right. AI helps create grounded questions from the student’s material. The student’s actual outcome evidence is what drives the recommendation.
---
# Team Workflow
GitHub should remain the source of truth.
Recommended development flow:
```text
Cursor / local development
       ↓
feature or development branch
       ↓
GitHub
       ↓
shared Replit/deployment environment
```
Before pulling another teammate’s work:
```bash
git status
```
Prefer a clean working tree before syncing.
Typical sync:
```bash
git fetch origin
git checkout shane-dev
git pull --ff-only origin shane-dev
```
Before pushing:
```bash
git status
git diff --check
npm test
npm run typecheck
npm run build
```
Then:
```bash
git add -A
git commit -m "Describe the change"
git push origin shane-dev
```
Never commit:
- `.env.local`
- `ml-service/.env`
- HF tokens
- production secrets
- Python virtual environments
---
# Project Structure
```text
src/
  app/
    start/
    how-it-works/
    onboarding/
    dashboard/
    subjects/
    questions/
    study/
    feedback/
    insights/
    api/
  components/
    shared UI components
    question count control
  lib/
    db/
    techniques.ts
    technique-guidance.ts
    hypothesis.ts
    stats.ts
    recommend.ts
    question-count.ts
    question-bank-list.ts
    question-handoff.ts
    demo-questions.ts
    __tests__/
ml-service/
  app/
    main.py
    schemas.py
    question_generator.py
  tests/
  requirements.txt
drizzle/
  database migrations
scripts/
  migration / seed utilities
docs/
  WHITEPAPER.md
```
---
# Current Limitations and Future Work
Calibrate is a strong MVP, but it is not yet a production multi-user learning platform.
## Authentication / accounts
Not implemented.
Future work:
- login
- user accounts
- per-user data isolation
- session management
- account deletion/export
## Production database
Current application persistence uses SQLite.
SQLite is appropriate for local development and the current demo, but a public multi-user release should migrate to durable hosted storage such as PostgreSQL.
Future work:
- hosted Postgres
- production-safe migrations
- per-user ownership constraints
- backups
- data retention strategy
## Demo data
The current project may contain seeded presentation evidence so Dashboard and Insights look mature during demonstrations.
For a real public launch:
- new users should start with clean personal evidence
- seeded history should not appear as their own activity
- example data should remain optional and explicitly labeled
## Study → Insights handoff
The current Study completion flow can route to Insights, but it does not yet deeply focus the Insights page on the **specific session that just finished**.
Future improvement:
```text
Session complete
   ↓
View this session’s impact
   ↓
Insight focused on:
subject + technique + new evidence point
```
## Confidence and recall metrics
The current MVP has limitations around independent confidence/recall measurement.
Future work should make these metrics genuinely independent if they are surfaced as separate evidence:
- explicit confidence input
- independently measured unaided recall
- clearer metric provenance
Avoid presenting derived values as if they were separately measured.
## Feynman evaluation
Feynman / Self-Explanation currently uses a self-check-oriented MVP flow.
Future work could add:
- rubric-based evaluation
- narrow AI feedback
- explanation-quality dimensions
The LLM should still not decide the overall winning study technique.
## Spaced repetition
Current Spaced Repetition guidance does not include a full scheduling engine.
Future work:
- spaced review scheduling
- due dates
- recall history per question
- optional SM-2 or another transparent scheduling method
## PDF support
Current:
- text-based PDFs supported
- scanned/image PDFs unsupported
Future:
- OCR
- better document structure extraction
- section/chapter-aware generation
- citation/page references
## Question grading
Some question types rely on self-check behavior.
Future:
- stronger answer evaluation
- partial-credit support
- typed-answer grading
- explanation feedback
Any automatic grading should remain transparent and auditable.
## Question generation reliability
Live AI generation depends on:
- FastAPI availability
- Hugging Face availability
- provider/model availability
- token permissions
- inference quota/credits
Future production work should add:
- rate limiting
- observability
- generation logging
- retry strategy
- cost controls
- provider fallback only if explicitly designed and honestly surfaced
Calibrate currently avoids silent fallback from real AI to demo generation.
## Deployment
A public deployment still needs production configuration.
The immediate demo architecture can host:
```text
Next.js
+
FastAPI
+
server-side Hugging Face secret
```
Public users should **not** need to supply their own API keys.
Before an advertised production launch, also address:
- persistent hosted database
- authentication
- per-user data isolation
- production secrets
- AI usage/cost limits
- monitoring
- rate limiting
## Insight quality
Insights currently depend on repeated outcome evidence.
Future improvements:
- session-specific insight handoff
- clearer visual explanation of how one session changed the evidence
- longitudinal trends
- material/topic-level comparisons
- stronger uncertainty visualization
- explainable sample-size thresholds
Recommendations should remain deterministic and evidence-based.
---
# Product Principle
Calibrate should remain centered on this idea:
> **Do not tell students what kind of learner they are. Help them test study techniques and see what their own evidence says.**
AI supports the workflow.
**Student outcomes drive the recommendation.**
---
## License
MIT — see `LICENSE`.
