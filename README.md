# Calibrate

> TODO: The future flow is welcome click-to-begin → onboarding steps → dashboard app shell, with onboarding remaining accessible later from the sidebar.

An AI‑assisted study coach that helps students discover **which evidence‑based study
techniques actually work for them** — through real experimentation, not learning‑style
labels.

Calibrate starts with a short behavioral onboarding to form a *starting hypothesis*, then
guides you through techniques like **active recall, spaced repetition, Feynman /
self‑explanation, and practice questions**. You log study sessions and take a quick outcome
check after each one. Over time the app compares results per subject and shows which methods
are working best for you. AI is used **narrowly** — to generate practice questions from your
own material, give feedback, and phrase insight summaries. Every recommendation is computed
transparently from your data (see `src/lib/recommend.ts`); no black‑box model decides what
works for you.

---

## Quickstart

Requires **Node.js 18.17+** (Node 20 or 22 recommended). Runs fully offline — no API key needed.

```bash
npm install
cp .env.example .env.local     # optional; defaults work out of the box
npm run setup                  # create the SQLite DB, run migrations, seed demo data
npm run dev                    # http://localhost:3000
```

`npm run setup` seeds a realistic demo (3 subjects, ~49 sessions) so the dashboard and
insights are populated on first run. To start empty instead, run only `npm run db:migrate`.

Useful scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the app in development |
| `npm run build && npm start` | Production build and serve |
| `npm run db:migrate` | Create/upgrade the SQLite schema |
| `npm run db:seed` | Load the demo dataset |
| `npm run db:reset` | Wipe + migrate + seed from scratch |
| `npm test` | Run the Vitest unit suite (engine, stats, hypothesis) |
| `npm run typecheck` | Type‑check the whole project |

---

## The AI is optional and swappable

By default Calibrate uses a built‑in **offline mock** that turns your pasted material into
sensible questions using plain heuristics — zero setup, zero keys. To use a real model, set
`LLM_PROVIDER` in `.env.local`:

- **`mock`** – deterministic, offline (default).
- **`ollama`** – local open‑source models. Install [Ollama](https://ollama.com),
  `ollama pull llama3.1`, then set `LLM_PROVIDER=ollama`.
- **`openai`** – any OpenAI‑compatible endpoint (OpenAI, LM Studio, llama.cpp `--api`, vLLM).
  Set `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`.

If a real provider is unavailable at request time, the app **transparently falls back to the
mock** and labels the output honestly, so the demo never breaks.

---

## How it works

1. **Onboarding** asks a few behavioral questions (how you study, where you struggle) and
   forms a *starting hypothesis* — an educated first guess, explicitly to be tested.
2. **Study sessions** let you pick a subject and technique, run a focus timer, and record a
   quick **outcome check**: quiz/self‑test score, unaided recall, and confidence.
3. Every checked session becomes one **evidence record**. The recommendation engine averages
   a fair `outcome score` per technique within each subject, attaches a 95% confidence
   interval, and only claims a "clear signal" when the leader genuinely separates from the
   pack given the sample size.
4. The **insights dashboard** shows the comparison as a chart per subject, with the
   hypothesis‑vs‑evidence contrast front and center on the home page.

The whole scoring and ranking logic is a few hundred lines of readable TypeScript in
`src/lib/stats.ts` and `src/lib/recommend.ts`.

---

## Tech stack (all open source)

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS** for styling
- **SQLite** via **better‑sqlite3**, with **Drizzle ORM** + migrations
- **Recharts** for the insights charts
- **Zod** for input validation
- Pluggable LLM layer: **mock / Ollama / OpenAI‑compatible**

## Project structure

```
src/
  app/
    page.tsx              Dashboard (hypothesis vs. evidence)
    onboarding/           Behavioral onboarding → starting hypothesis
    study/                Log a session + outcome check
    questions/            Question bank: generate, practice, feedback
    insights/             Per‑subject technique comparison charts
    subjects/             Manage subjects
    api/                  Route handlers (subjects, sessions, outcomes,
                          questions, questions/generate, insights,
                          onboarding, feedback, materials)
  lib/
    db/                   Drizzle schema + connection
    techniques.ts         Catalog of evidence‑based techniques
    hypothesis.ts         Rule‑based onboarding → hypothesis
    stats.ts              Small, inspectable statistics
    recommend.ts          The transparent recommendation engine
    llm/                  Provider interface + mock / ollama / openai
    __tests__/            Vitest unit tests (engine boundaries, stats, hypothesis)
scripts/
  migrate.ts              Apply Drizzle migrations
  seed.ts                 Seed the demo dataset
docs/
  WHITEPAPER.md           Step‑by‑step build guide (4‑week plan)
```

See **`docs/WHITEPAPER.md`** for a full, step‑by‑step guide to building this from scratch.

## License

MIT — see `LICENSE`.
