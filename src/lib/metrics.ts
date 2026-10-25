/**
 * Pilot metrics: pure functions over raw rows, so the logic is unit tested and
 * the script (scripts/metrics.mts) only has to run queries and print.
 *
 * Definitions (all restricted to pilot users and real, non-demo evidence):
 *  - pilot user        : any user except the shared demo/local user and any
 *                        excluded team emails.
 *  - completed session : a `real` session that has an outcome row (the same
 *                        evidence the recommendation engine reads).
 *  - returned          : completed sessions on 2+ different calendar days
 *                        (in the configured time zone).
 *  - D7 retained       : among users whose first completed session was 7+ days
 *                        ago, those with another completed session 7+ days
 *                        after their first.
 */

export interface MetricsUser {
  id: string;
  email: string | null;
  createdAt: string;
}
export interface MetricsQuestion {
  userId: string;
  status: string;
  source: string;
}
export interface MetricsSession {
  id: string;
  userId: string;
  startedAt: string;
  evidenceOrigin: string;
}
export interface MetricsGeneration {
  userId: string;
  kind: string;
  ok: boolean;
  errorCode: string | null;
}

export interface MetricsInput {
  users: MetricsUser[];
  onboardedUserIds: string[];
  subjectUserIds: string[];
  questions: MetricsQuestion[];
  sessions: MetricsSession[];
  /** Session ids that have at least one outcome row. */
  outcomeSessionIds: string[];
  generations: MetricsGeneration[];
}

export interface MetricsOptions {
  /** Users never counted (the shared demo account). */
  excludeUserIds?: string[];
  /** Team/test emails, matched case-insensitively. */
  excludeEmails?: string[];
  /** IANA zone used to bucket sessions into calendar days. */
  timeZone?: string;
  now?: Date;
  /** Only count users created at or after this instant. */
  since?: Date;
}

export interface PilotMetrics {
  generatedAt: string;
  timeZone: string;
  funnel: {
    signedUp: number;
    onboarded: number;
    createdSubject: number;
    generatedQuestions: number;
    reviewedQuestion: number;
    approvedQuestion: number;
    completedSession: number;
  };
  repeatUsage: {
    totalCompletedSessions: number;
    usersWith1: number;
    usersWith2Plus: number;
    usersWith3Plus: number;
    returnedOnDifferentDay: number;
    avgSessionsPerActiveUser: number;
    d7Eligible: number;
    d7Retained: number;
  };
  questionReview: {
    aiQuestions: number;
    awaitingReview: number;
    approved: number;
    edited: number;
    rejected: number;
    approvedShareOfReviewed: number | null;
    editedShareOfReviewed: number | null;
    rejectedShareOfReviewed: number | null;
  };
  generation: {
    attempts: number;
    succeeded: number;
    failed: number;
    failureRate: number | null;
    failuresByCode: Record<string, number>;
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(iso: string, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

const share = (n: number, d: number): number | null => (d === 0 ? null : n / d);

export function computeMetrics(input: MetricsInput, options: MetricsOptions = {}): PilotMetrics {
  const timeZone = options.timeZone ?? "America/Los_Angeles";
  const now = options.now ?? new Date();
  const excludedIds = new Set(options.excludeUserIds ?? []);
  const excludedEmails = new Set((options.excludeEmails ?? []).map((e) => e.trim().toLowerCase()));

  const pilot = input.users.filter((u) => {
    if (excludedIds.has(u.id)) return false;
    if (u.email && excludedEmails.has(u.email.toLowerCase())) return false;
    if (options.since && new Date(u.createdAt) < options.since) return false;
    return true;
  });
  const pilotIds = new Set(pilot.map((u) => u.id));
  const inPilot = (id: string) => pilotIds.has(id);
  const usersWith = (ids: Iterable<string>) => new Set([...ids].filter(inPilot));

  // --- Sessions ---------------------------------------------------------
  const withOutcome = new Set(input.outcomeSessionIds);
  const completed = input.sessions
    .filter((s) => s.evidenceOrigin === "real" && withOutcome.has(s.id) && inPilot(s.userId))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  const byUser = new Map<string, MetricsSession[]>();
  for (const s of completed) {
    const list = byUser.get(s.userId) ?? [];
    list.push(s);
    byUser.set(s.userId, list);
  }

  let usersWith1 = 0;
  let usersWith2Plus = 0;
  let usersWith3Plus = 0;
  let returned = 0;
  let d7Eligible = 0;
  let d7Retained = 0;
  for (const sessions of byUser.values()) {
    usersWith1 += 1;
    if (sessions.length >= 2) usersWith2Plus += 1;
    if (sessions.length >= 3) usersWith3Plus += 1;
    const days = new Set(sessions.map((s) => dayKey(s.startedAt, timeZone)));
    if (days.size >= 2) returned += 1;

    const firstMs = new Date(sessions[0].startedAt).getTime();
    if (now.getTime() - firstMs >= 7 * DAY_MS) {
      d7Eligible += 1;
      if (sessions.some((s) => new Date(s.startedAt).getTime() - firstMs >= 7 * DAY_MS)) {
        d7Retained += 1;
      }
    }
  }

  // --- Generation -------------------------------------------------------
  const gens = input.generations.filter((g) => inPilot(g.userId));
  const failuresByCode: Record<string, number> = {};
  for (const g of gens) {
    if (!g.ok) failuresByCode[g.errorCode ?? "UNEXPECTED"] = (failuresByCode[g.errorCode ?? "UNEXPECTED"] ?? 0) + 1;
  }
  const succeeded = gens.filter((g) => g.ok).length;

  // --- Questions --------------------------------------------------------
  const ai = input.questions.filter((q) => q.source === "ai" && inPilot(q.userId));
  const count = (status: string) => ai.filter((q) => q.status === status).length;
  const approved = count("approved");
  const edited = count("edited");
  const rejected = count("rejected");
  const reviewed = approved + edited + rejected;

  const generatedUsers = usersWith([
    ...gens.filter((g) => g.ok).map((g) => g.userId),
    ...ai.map((q) => q.userId),
  ]);

  return {
    generatedAt: now.toISOString(),
    timeZone,
    funnel: {
      signedUp: pilot.length,
      onboarded: usersWith(input.onboardedUserIds).size,
      createdSubject: usersWith(input.subjectUserIds).size,
      generatedQuestions: generatedUsers.size,
      reviewedQuestion: usersWith(
        ai.filter((q) => q.status !== "generated").map((q) => q.userId),
      ).size,
      approvedQuestion: usersWith(
        ai.filter((q) => q.status === "approved").map((q) => q.userId),
      ).size,
      completedSession: byUser.size,
    },
    repeatUsage: {
      totalCompletedSessions: completed.length,
      usersWith1,
      usersWith2Plus,
      usersWith3Plus,
      returnedOnDifferentDay: returned,
      avgSessionsPerActiveUser: byUser.size === 0 ? 0 : completed.length / byUser.size,
      d7Eligible,
      d7Retained,
    },
    questionReview: {
      aiQuestions: ai.length,
      awaitingReview: count("generated"),
      approved,
      edited,
      rejected,
      approvedShareOfReviewed: share(approved, reviewed),
      editedShareOfReviewed: share(edited, reviewed),
      rejectedShareOfReviewed: share(rejected, reviewed),
    },
    generation: {
      attempts: gens.length,
      succeeded,
      failed: gens.length - succeeded,
      failureRate: share(gens.length - succeeded, gens.length),
      failuresByCode,
    },
  };
}

const pct = (v: number | null) => (v === null ? "n/a" : `${(v * 100).toFixed(0)}%`);

/** Plain-text report suitable for pasting into notes or the application. */
export function formatMetrics(m: PilotMetrics): string {
  const f = m.funnel;
  const r = m.repeatUsage;
  const q = m.questionReview;
  const g = m.generation;
  const failures = Object.entries(g.failuresByCode)
    .sort((a, b) => b[1] - a[1])
    .map(([code, n]) => `${code}: ${n}`)
    .join(", ");
  const d7 = r.d7Eligible === 0 ? "n/a (no one is 7+ days past their first session yet)" : `${r.d7Retained} of ${r.d7Eligible}`;
  return [
    `Calibrate pilot metrics  |  ${m.generatedAt}  |  days bucketed in ${m.timeZone}`,
    "(real evidence only; demo account and excluded team emails removed)",
    "",
    "FUNNEL (users)",
    `  Signed up ................ ${f.signedUp}`,
    `  Finished onboarding ...... ${f.onboarded}`,
    `  Created a subject ........ ${f.createdSubject}`,
    `  Generated questions ...... ${f.generatedQuestions}`,
    `  Reviewed a question ...... ${f.reviewedQuestion}`,
    `  Approved a question ...... ${f.approvedQuestion}`,
    `  Completed a session ...... ${f.completedSession}`,
    "",
    "REPEAT USAGE (completed, outcome-checked sessions)",
    `  Total sessions ........... ${r.totalCompletedSessions}`,
    `  Users with 2+ sessions ... ${r.usersWith2Plus}`,
    `  Users with 3+ sessions ... ${r.usersWith3Plus}`,
    `  Returned on another day .. ${r.returnedOnDifferentDay}`,
    `  Avg sessions / active .... ${r.avgSessionsPerActiveUser.toFixed(1)}`,
    `  D7 retained .............. ${d7}`,
    "",
    "QUESTION REVIEW (AI-generated)",
    `  Total .................... ${q.aiQuestions} (${q.awaitingReview} awaiting review)`,
    `  Approved / Edited / Rejected: ${q.approved} / ${q.edited} / ${q.rejected}`,
    `  Share of reviewed ........ approved ${pct(q.approvedShareOfReviewed)}, edited ${pct(q.editedShareOfReviewed)}, rejected ${pct(q.rejectedShareOfReviewed)}`,
    "  Note: 'edited' is a review state; an edited question may later be approved.",
    "",
    "GENERATION",
    `  Attempts ................. ${g.attempts} (${g.succeeded} ok, ${g.failed} failed, failure rate ${pct(g.failureRate)})`,
    `  Failures by code ......... ${failures || "none"}`,
  ].join("\n");
}
