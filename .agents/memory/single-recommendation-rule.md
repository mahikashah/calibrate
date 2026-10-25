---
name: One recommendation, one engine
description: Why Dashboard and Insights must render the identical deterministic recommendation, and what an "evidence record" actually counts.
---

# One recommendation, one engine

Every surface that tells the student which study technique to use renders the
*same* deterministic recommendation, derived from `computeInsights` output via
the shared `currentRecommendation` helper. No page may compute its own variant,
and no LLM may pick a technique.

**Why:** the product's credibility rests on the student being able to click
"View why" and land on the evidence that produced the advice. If two surfaces
apply even slightly different filters, they can name different techniques and
the "transparent evidence" promise breaks.

**How to apply:** when adding a surface that shows advice, feed it the existing
insights evidence query and the shared helper. If a new filter seems necessary
(completed-only, deduplicated, date-bounded), it must be applied to *every*
surface at once, or not at all.

## Evidence granularity

An evidence record is one **outcome check**, not one session. A session that is
re-checked later legitimately contributes more than one record, and the
recommendation engine treats them as separate data points.

**Why:** spaced re-checking of the same session is a designed part of the
measurement, so collapsing to one row per session would silently discard data.

**How to apply:** never label an evidence count "sessions". Count completed
sessions from the sessions table and outcome checks from the outcomes table,
and word the UI accordingly — conflating them makes the totals look wrong even
when the engine is right.

## Real vs demo

Student-facing state (counts, latest session, progress, recommendation) reads
`evidence_origin = 'real'` only. Seeded presentation data is opt-in and lives
behind an explicit source toggle.
