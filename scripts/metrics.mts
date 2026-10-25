/**
 * Pilot metrics report.
 *
 *   npm run metrics
 *   npm run metrics -- --exclude-emails=me@x.edu,teammate@x.edu --tz=America/Los_Angeles
 *   npm run metrics -- --since=2026-10-26 --json
 *
 * Reads the same database as the app (Turso when TURSO_DATABASE_URL is set,
 * otherwise the local SQLite file). Read-only. Use a read of the production
 * Turso credentials, never print them.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import path from "node:path";
import { assertDurableDatabase } from "../src/lib/db/config";
import {
  generationEvents,
  onboarding,
  outcomes,
  questions,
  sessions,
  subjects,
  users,
} from "../src/lib/db/schema";
import { computeMetrics, formatMetrics } from "../src/lib/metrics";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

assertDurableDatabase();
const DB_PATH = process.env.DATABASE_PATH || "./db/studycoach.sqlite";
const client = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${path.resolve(process.cwd(), DB_PATH)}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = drizzle(client);

const excludeEmails = (arg("exclude-emails") ?? process.env.METRICS_EXCLUDE_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);
const sinceText = arg("since");
const since = sinceText ? new Date(`${sinceText}T00:00:00`) : undefined;
if (since && Number.isNaN(since.getTime())) {
  console.error(`Invalid --since value "${sinceText}". Use YYYY-MM-DD.`);
  process.exit(1);
}

const [userRows, onboardRows, subjectRows, questionRows, sessionRows, outcomeRows, genRows] =
  await Promise.all([
    db.select().from(users),
    db.select({ userId: onboarding.userId }).from(onboarding),
    db.select({ userId: subjects.userId }).from(subjects),
    db.select({ userId: questions.userId, status: questions.status, source: questions.source }).from(questions),
    db.select().from(sessions),
    db.select({ sessionId: outcomes.sessionId }).from(outcomes),
    db.select().from(generationEvents),
  ]);

const metrics = computeMetrics(
  {
    users: userRows.map((u) => ({ id: u.id, email: u.email, createdAt: u.createdAt })),
    onboardedUserIds: onboardRows.map((r) => r.userId),
    subjectUserIds: subjectRows.map((r) => r.userId),
    questions: questionRows,
    sessions: sessionRows.map((s) => ({
      id: s.id,
      userId: s.userId,
      startedAt: s.startedAt,
      evidenceOrigin: s.evidenceOrigin,
    })),
    outcomeSessionIds: outcomeRows.map((r) => r.sessionId),
    generations: genRows.map((g) => ({
      userId: g.userId,
      kind: g.kind,
      ok: g.ok,
      errorCode: g.errorCode,
    })),
  },
  {
    excludeUserIds: ["local-user"],
    excludeEmails,
    timeZone: arg("tz") ?? "America/Los_Angeles",
    since,
  },
);

console.log(process.argv.includes("--json") ? JSON.stringify(metrics, null, 2) : formatMetrics(metrics));
client.close();
