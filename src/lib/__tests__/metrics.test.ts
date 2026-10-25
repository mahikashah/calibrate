import { describe, expect, it } from "vitest";
import { computeMetrics, formatMetrics, type MetricsInput } from "../metrics";

const NOW = new Date("2026-11-03T20:00:00.000Z");
const iso = (s: string) => new Date(s).toISOString();

function base(): MetricsInput {
  return {
    users: [
      { id: "local-user", email: null, createdAt: iso("2026-08-01T00:00:00Z") },
      { id: "u1", email: "one@school.edu", createdAt: iso("2026-10-20T00:00:00Z") },
      { id: "u2", email: "two@school.edu", createdAt: iso("2026-10-27T00:00:00Z") },
      { id: "u3", email: "three@school.edu", createdAt: iso("2026-10-28T00:00:00Z") },
      { id: "team", email: "Team@School.edu", createdAt: iso("2026-10-20T00:00:00Z") },
    ],
    onboardedUserIds: ["u1", "u2", "team", "local-user"],
    subjectUserIds: ["u1", "u2", "team"],
    questions: [
      { userId: "u1", status: "approved", source: "ai" },
      { userId: "u1", status: "approved", source: "ai" },
      { userId: "u1", status: "edited", source: "ai" },
      { userId: "u1", status: "rejected", source: "ai" },
      { userId: "u2", status: "generated", source: "ai" },
      { userId: "u1", status: "approved", source: "user" }, // hand-written: not an AI question
      { userId: "team", status: "approved", source: "ai" }, // excluded
    ],
    sessions: [
      // u1: first session Oct 26, another 8 days later -> D7 retained, returned on another day
      { id: "s1", userId: "u1", startedAt: iso("2026-10-26T18:00:00Z"), evidenceOrigin: "real" },
      { id: "s2", userId: "u1", startedAt: iso("2026-11-03T18:00:00Z"), evidenceOrigin: "real" },
      { id: "s3", userId: "u1", startedAt: iso("2026-10-28T18:00:00Z"), evidenceOrigin: "real" },
      // u2: two sessions on the same LA calendar day
      { id: "s4", userId: "u2", startedAt: iso("2026-10-29T17:00:00Z"), evidenceOrigin: "real" },
      { id: "s5", userId: "u2", startedAt: iso("2026-10-29T22:00:00Z"), evidenceOrigin: "real" },
      // no outcome row -> not completed
      { id: "s6", userId: "u3", startedAt: iso("2026-10-30T18:00:00Z"), evidenceOrigin: "real" },
      // demo evidence and excluded users never count
      { id: "s7", userId: "u3", startedAt: iso("2026-10-30T19:00:00Z"), evidenceOrigin: "demo" },
      { id: "s8", userId: "team", startedAt: iso("2026-10-30T19:00:00Z"), evidenceOrigin: "real" },
      { id: "s9", userId: "local-user", startedAt: iso("2026-10-30T19:00:00Z"), evidenceOrigin: "real" },
    ],
    outcomeSessionIds: ["s1", "s2", "s3", "s4", "s5", "s7", "s8", "s9"],
    generations: [
      { userId: "u1", kind: "notes", ok: true, errorCode: null },
      { userId: "u1", kind: "pdf", ok: false, errorCode: "UNSUPPORTED_PDF" },
      { userId: "u2", kind: "notes", ok: false, errorCode: "MODEL_TIMEOUT" },
      { userId: "u2", kind: "notes", ok: false, errorCode: "MODEL_TIMEOUT" },
      { userId: "team", kind: "notes", ok: true, errorCode: null },
    ],
  };
}

const opts = { excludeUserIds: ["local-user"], excludeEmails: ["team@school.edu"], now: NOW };

describe("computeMetrics", () => {
  it("excludes the demo user and team emails (case-insensitive) from every count", () => {
    const m = computeMetrics(base(), opts);
    expect(m.funnel.signedUp).toBe(3);
    expect(m.funnel.onboarded).toBe(2);
    expect(m.funnel.createdSubject).toBe(2);
  });

  it("builds the funnel from real, outcome-backed sessions only", () => {
    const m = computeMetrics(base(), opts);
    expect(m.funnel.generatedQuestions).toBe(2); // u1 (ok event), u2 (ai question)
    expect(m.funnel.reviewedQuestion).toBe(1);
    expect(m.funnel.approvedQuestion).toBe(1);
    expect(m.funnel.completedSession).toBe(2); // u3's only real session has no outcome
    expect(m.repeatUsage.totalCompletedSessions).toBe(5);
  });

  it("counts repeat usage by sessions and by distinct calendar days", () => {
    const r = computeMetrics(base(), opts).repeatUsage;
    expect(r.usersWith2Plus).toBe(2);
    expect(r.usersWith3Plus).toBe(1);
    expect(r.returnedOnDifferentDay).toBe(1); // u2's two sessions share a day
    expect(r.avgSessionsPerActiveUser).toBeCloseTo(2.5);
  });

  it("buckets days in the configured time zone, not UTC", () => {
    const input: MetricsInput = {
      ...base(),
      users: [{ id: "x", email: "x@school.edu", createdAt: iso("2026-10-20T00:00:00Z") }],
      sessions: [
        // Same UTC day, but 11:30pm Oct 25 vs 1:30am Oct 26 in Los Angeles (PDT).
        { id: "a", userId: "x", startedAt: iso("2026-10-26T06:30:00Z"), evidenceOrigin: "real" },
        { id: "b", userId: "x", startedAt: iso("2026-10-26T08:30:00Z"), evidenceOrigin: "real" },
      ],
      outcomeSessionIds: ["a", "b"],
      onboardedUserIds: [],
      subjectUserIds: [],
      questions: [],
      generations: [],
    };
    expect(computeMetrics(input, { now: NOW, timeZone: "America/Los_Angeles" }).repeatUsage.returnedOnDifferentDay).toBe(1);
    expect(computeMetrics(input, { now: NOW, timeZone: "UTC" }).repeatUsage.returnedOnDifferentDay).toBe(0);
  });

  it("computes D7 retention only among users old enough to measure", () => {
    const r = computeMetrics(base(), opts).repeatUsage;
    // u1's first session was 8 days before NOW and they returned 8 days later; u2 is too new.
    expect(r.d7Eligible).toBe(1);
    expect(r.d7Retained).toBe(1);
    const early = computeMetrics(base(), { ...opts, now: new Date("2026-10-31T00:00:00Z") }).repeatUsage;
    expect(early.d7Eligible).toBe(0);
  });

  it("summarises AI question review", () => {
    const q = computeMetrics(base(), opts).questionReview;
    expect(q).toMatchObject({ aiQuestions: 5, awaitingReview: 1, approved: 2, edited: 1, rejected: 1 });
    expect(q.approvedShareOfReviewed).toBeCloseTo(0.5);
    expect(q.editedShareOfReviewed).toBeCloseTo(0.25);
    expect(q.rejectedShareOfReviewed).toBeCloseTo(0.25);
  });

  it("summarises generation failures by code", () => {
    const g = computeMetrics(base(), opts).generation;
    expect(g).toMatchObject({ attempts: 4, succeeded: 1, failed: 3 });
    expect(g.failureRate).toBeCloseTo(0.75);
    expect(g.failuresByCode).toEqual({ UNSUPPORTED_PDF: 1, MODEL_TIMEOUT: 2 });
  });

  it("can restrict to users created on or after --since", () => {
    const m = computeMetrics(base(), { ...opts, since: new Date("2026-10-27T00:00:00Z") });
    expect(m.funnel.signedUp).toBe(2); // u2, u3
  });

  it("handles an empty pilot without dividing by zero", () => {
    const m = computeMetrics(
      { users: [], onboardedUserIds: [], subjectUserIds: [], questions: [], sessions: [], outcomeSessionIds: [], generations: [] },
      { now: NOW },
    );
    expect(m.repeatUsage.avgSessionsPerActiveUser).toBe(0);
    expect(m.questionReview.approvedShareOfReviewed).toBeNull();
    expect(m.generation.failureRate).toBeNull();
    expect(() => formatMetrics(m)).not.toThrow();
  });
});

describe("formatMetrics", () => {
  it("renders a readable report", () => {
    const text = formatMetrics(computeMetrics(base(), opts));
    expect(text).toContain("Users with 2+ sessions ... 2");
    expect(text).toContain("D7 retained .............. 1 of 1");
    expect(text).toContain("MODEL_TIMEOUT: 2");
  });

  it("says D7 is not measurable yet when nobody is old enough", () => {
    const text = formatMetrics(computeMetrics(base(), { ...opts, now: new Date("2026-10-31T00:00:00Z") }));
    expect(text).toMatch(/D7 retained .* n\/a/);
  });
});
