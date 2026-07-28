import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  materials,
  onboarding,
  outcomes,
  questions,
  sessions,
  subjects,
  users,
} from "../src/lib/db/schema";
import { computeHypothesis } from "../src/lib/hypothesis";
import { MockProvider } from "../src/lib/llm/mock";
import { outcomeScore } from "../src/lib/stats";
import type { TechniqueId } from "../src/lib/techniques";

const DB_PATH = process.env.DATABASE_PATH || "./db/studycoach.sqlite";
const sqlite = new Database(path.resolve(process.cwd(), DB_PATH));
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite);

const id = (p: string) => `${p}_${randomUUID().slice(0, 12)}`;
const USER = "local-user";

// Deterministic-ish jitter so the demo is stable but not flat.
let seedN = 42;
function rand() {
  seedN = (seedN * 1103515245 + 12345) & 0x7fffffff;
  return seedN / 0x7fffffff;
}
function jitter(mean: number, spread = 4) {
  return Math.max(0, Math.min(100, Math.round(mean + (rand() - 0.5) * spread * 2)));
}
function daysAgo(d: number) {
  return new Date(Date.now() - d * 86_400_000).toISOString();
}

console.log("Seeding StudyCoach demo data...");

// Wipe existing rows (idempotent reseed).
for (const t of [outcomes, sessions, questions, materials, onboarding, subjects, users]) {
  db.delete(t).run();
}

db.insert(users).values({ id: USER, name: "Alex", createdAt: daysAgo(30) }).run();

const SUBJECTS = [
  { key: "chem", name: "Organic Chemistry", color: "#0E7C66" },
  { key: "calc", name: "Calculus II", color: "#4F46B8" },
  { key: "span", name: "Spanish Vocab", color: "#B26A00" },
];
const subjectId: Record<string, string> = {};
for (const s of SUBJECTS) {
  const sid = id("sub");
  subjectId[s.key] = sid;
  db.insert(subjects).values({ id: sid, userId: USER, name: s.name, color: s.color, createdAt: daysAgo(28) }).run();
}

// Onboarding hypothesis: guesses "active recall" — the data will disagree,
// which is exactly the point the product is making.
const answers = { retention: 1, struggle: 1, check: 0, consistency: 1, subject_type: 1 };
db.insert(onboarding)
  .values({
    id: id("onb"),
    userId: USER,
    answers: JSON.stringify(answers),
    hypothesis: JSON.stringify(computeHypothesis(answers)),
    createdAt: daysAgo(28),
  })
  .run();

// The experiment design: mean outcome per (subject, technique) and how many
// sessions to log. Tight variance + real separation => "clear signal".
const PLAN: Record<string, { tech: TechniqueId; mean: number; n: number }[]> = {
  chem: [
    { tech: "active_recall", mean: 86, n: 6 },
    { tech: "practice_questions", mean: 76, n: 5 },
    { tech: "feynman", mean: 70, n: 4 },
    { tech: "rereading", mean: 56, n: 4 },
  ],
  calc: [
    { tech: "practice_questions", mean: 84, n: 6 },
    { tech: "feynman", mean: 74, n: 4 },
    { tech: "active_recall", mean: 70, n: 4 },
    { tech: "rereading", mean: 60, n: 3 },
  ],
  span: [
    { tech: "spaced_repetition", mean: 80, n: 5 },
    { tech: "active_recall", mean: 78, n: 5 },
    { tech: "rereading", mean: 62, n: 3 },
  ],
};

let day = 24;
let sessionCount = 0;
for (const [key, plan] of Object.entries(PLAN)) {
  for (const { tech, mean, n } of plan) {
    for (let i = 0; i < n; i++) {
      const when = daysAgo(Math.max(0, day - rand() * 3));
      day -= 0.7;
      const quiz = jitter(mean);
      const recall = jitter(mean);
      const confidence = Math.max(1, Math.min(5, Math.round(mean / 22) + (rand() > 0.6 ? 1 : 0)));
      const minutes = 20 + Math.round(rand() * 20);

      const sid = id("ses");
      db.insert(sessions)
        .values({
          id: sid,
          userId: USER,
          subjectId: subjectId[key],
          technique: tech,
          materialId: null,
          plannedMinutes: 25,
          actualMinutes: minutes,
          notes: "",
          startedAt: when,
          endedAt: when,
        })
        .run();
      db.insert(outcomes)
        .values({
          id: id("out"),
          sessionId: sid,
          quizScore: quiz,
          confidence,
          recall,
          notes: "",
          createdAt: when,
        })
        .run();
      sessionCount++;
      void outcomeScore; // keep the import meaningful; UI recomputes identically
    }
  }
}

// A little material + AI-generated (mock) question bank per subject.
const MATERIAL: Record<string, { title: string; content: string }> = {
  chem: {
    title: "SN1 vs SN2 reactions",
    content:
      "Nucleophilic substitution reactions proceed by two main mechanisms. In an SN2 reaction the nucleophile attacks the electrophilic carbon in a single concerted step, causing inversion of configuration. SN2 rates depend on both the substrate and the nucleophile, and are fastest for methyl and primary carbons. In an SN1 reaction the leaving group departs first to form a carbocation intermediate, and the rate depends only on the substrate. Tertiary carbons favor SN1 because the resulting carbocation is more stable. Polar protic solvents stabilize the SN1 transition state.",
  },
  calc: {
    title: "Integration by parts",
    content:
      "Integration by parts is derived from the product rule for differentiation. The formula states that the integral of u dv equals uv minus the integral of v du. Choosing u and dv well is the key skill: a common heuristic is LIATE, which orders logarithmic, inverse trig, algebraic, trigonometric, and exponential functions by priority for u. The method is especially useful for integrating products such as x times e to the x, or x times sine of x.",
  },
  span: {
    title: "Common irregular preterite verbs",
    content:
      "Several high-frequency Spanish verbs are irregular in the preterite tense. Tener becomes tuve, estar becomes estuve, and poder becomes pude. These verbs share a set of irregular endings that do not carry accent marks. Ser and ir are identical in the preterite: both conjugate as fui, fuiste, fue. Hacer becomes hice, with a spelling change to hizo in the third person singular to preserve the soft sound.",
  },
};

async function seedQuestionBank() {
  const mock = new MockProvider();
  for (const [key, m] of Object.entries(MATERIAL)) {
    const mid = id("mat");
    db.insert(materials)
      .values({ id: mid, userId: USER, subjectId: subjectId[key], title: m.title, content: m.content, createdAt: daysAgo(20) })
      .run();
    const generated = await mock.generateQuestions({ material: m.content, subject: m.title, count: 4 });
    for (const q of generated) {
      db.insert(questions)
        .values({
          id: id("q"),
          userId: USER,
          subjectId: subjectId[key],
          materialId: mid,
          type: q.type,
          prompt: q.prompt,
          answer: q.answer,
          source: "ai",
          createdAt: daysAgo(20),
        })
        .run();
    }
  }
}

seedQuestionBank()
  .then(() => {
    console.log(
      `Seeded ${SUBJECTS.length} subjects, ${sessionCount} sessions with outcomes, and a starter question bank.`,
    );
    sqlite.close();
  })
  .catch((err) => {
    console.error(err);
    sqlite.close();
    process.exit(1);
  });
