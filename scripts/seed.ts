import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
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
import { outcomeScore } from "../src/lib/stats";
import type { TechniqueId } from "../src/lib/techniques";

const DB_PATH = process.env.DATABASE_PATH || "./db/studycoach.sqlite";
const sqlite = new Database(path.resolve(process.cwd(), DB_PATH));
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite);

const id = (p: string) => `${p}_${randomUUID().slice(0, 12)}`;
const USER = "local-user";
const ASSETS_DIR = path.resolve(process.cwd(), "attached_assets");

type ParsedMaterial = {
  subject: string;
  file_name: string;
  text: string;
};

type SeedSubject = {
  key: string;
  name: string;
  color: string;
  questionFilePattern: RegExp;
};

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

console.log("Seeding Calibrate demo data...");

// Wipe existing rows (idempotent reseed).
for (const t of [outcomes, sessions, questions, materials, onboarding, subjects, users]) {
  db.delete(t).run();
}

db.insert(users).values({ id: USER, name: "Alex", createdAt: daysAgo(30) }).run();

const SUBJECTS: SeedSubject[] = [
  { key: "chicano", name: "Chicano Studies", color: "#0E7C66", questionFilePattern: /^chicano_studies_generated_questions_.*\.txt$/i },
  { key: "statistics", name: "Statistics", color: "#4F46B8", questionFilePattern: /^statistics_generated_questions_.*\.txt$/i },
  { key: "neuroscience", name: "Neuroscience", color: "#B26A00", questionFilePattern: /^neuroscience_generated_questions_.*\.txt$/i },
  { key: "literature", name: "Literature", color: "#7C3E8D", questionFilePattern: /^literature_generated_questions_.*\.txt$/i },
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
  chicano: [
    { tech: "active_recall", mean: 86, n: 6 },
    { tech: "practice_questions", mean: 76, n: 5 },
    { tech: "feynman", mean: 70, n: 4 },
    { tech: "rereading", mean: 56, n: 4 },
  ],
  statistics: [
    { tech: "practice_questions", mean: 84, n: 6 },
    { tech: "feynman", mean: 74, n: 4 },
    { tech: "active_recall", mean: 70, n: 4 },
    { tech: "rereading", mean: 60, n: 3 },
  ],
  neuroscience: [
    { tech: "spaced_repetition", mean: 80, n: 5 },
    { tech: "active_recall", mean: 78, n: 5 },
    { tech: "rereading", mean: 62, n: 3 },
  ],
  literature: [
    { tech: "feynman", mean: 82, n: 5 },
    { tech: "active_recall", mean: 76, n: 5 },
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

function cleanSubjectName(name: string) {
  return name.replace(/,+\s*$/, "").trim();
}

function parseGeneratedQuestions(content: string) {
  return content
    .split(/\r?\n(?=\d+\.\s)/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const lines = entry.replace(/^\d+\.\s*/, "").split(/\r?\n/);
      const prompt = lines.shift()?.trim() ?? "";
      const answer = lines
        .join("\n")
        .replace(/^\s*-\s*/, "")
        .trim();
      return { prompt, answer };
    })
    .filter((question) => question.prompt);
}

function findQuestionFile(subject: SeedSubject) {
  const fileName = fs.readdirSync(ASSETS_DIR).find((file) => subject.questionFilePattern.test(file));
  if (!fileName) {
    throw new Error(`Missing generated question file for ${subject.name}`);
  }
  return path.join(ASSETS_DIR, fileName);
}

function seedQuestionBank() {
  const parsedMaterials = JSON.parse(
    fs.readFileSync(path.join(ASSETS_DIR, "parsed_data_1785817790313.json"), "utf8"),
  ) as ParsedMaterial[];
  const materialsBySubject = new Map(
    parsedMaterials.map((material) => [cleanSubjectName(material.subject), material]),
  );

  for (const subject of SUBJECTS) {
    const material = materialsBySubject.get(subject.name);
    if (!material) {
      throw new Error(`Missing parsed material for ${subject.name}`);
    }

    const mid = id("mat");
    db.insert(materials)
      .values({
        id: mid,
        userId: USER,
        subjectId: subjectId[subject.key],
        title: material.file_name,
        content: material.text,
        createdAt: daysAgo(20),
      })
      .run();

    const generated = parseGeneratedQuestions(fs.readFileSync(findQuestionFile(subject), "utf8"));
    for (const q of generated) {
      db.insert(questions)
        .values({
          id: id("q"),
          userId: USER,
          subjectId: subjectId[subject.key],
          materialId: mid,
          type: "recall",
          prompt: q.prompt,
          answer: q.answer,
          source: "ai",
          createdAt: daysAgo(20),
        })
        .run();
    }
  }
}

try {
  seedQuestionBank();
  console.log(
    `Seeded ${SUBJECTS.length} subjects, ${sessionCount} sessions with outcomes, and a starter question bank.`,
  );
  sqlite.close();
} catch (err) {
  console.error(err);
  sqlite.close();
  process.exit(1);
}
