/**
 * Post-session feedback is CONTEXT, never a verdict.
 *
 * These strings exist so a flagged session can be explained without ever being
 * treated as evidence that a technique failed. Nothing here removes a session
 * from the evidence base or changes a recommendation.
 */

/** Long-form context lines used on Insights. */
export const FEEDBACK_MESSAGES: Record<string, string> = {
  questions_wrong: "Question quality may have affected this session.",
  material_hard: "Material difficulty may have influenced this session.",
  distracted_low_energy: "Session conditions may have influenced this session.",
  technique_wrong: "You felt the technique may not have fit this session.",
  not_sure: "You were not sure what affected this session.",
};

/** Compact chip labels used on the Dashboard's recent-session card. */
export const FEEDBACK_LABELS: Record<string, string> = {
  questions_wrong: "Question quality flagged",
  material_hard: "Material felt difficult",
  distracted_low_energy: "Low energy / distraction reported",
  technique_wrong: "Technique fit questioned",
  not_sure: "Cause not identified",
};

export function parseReasons(value: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((reason): reason is string => typeof reason === "string")
      : [];
  } catch {
    return [];
  }
}
