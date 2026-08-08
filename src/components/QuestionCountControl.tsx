"use client";

import {
  QUESTION_COUNT_DEFAULT,
  QUESTION_COUNT_MAX,
  QUESTION_COUNT_MIN,
} from "@/lib/question-count";

const PRESETS = [4, 6, 8, 10] as const;

type Props = {
  value: number;
  onChange: (next: number) => void;
  id?: string;
  label?: string;
  disabled?: boolean;
};

/**
 * Shared “Questions to generate” control — target count, not a hard quota.
 */
export function QuestionCountControl({
  value,
  onChange,
  id = "question-count-target",
  label = "Questions to generate",
  disabled = false,
}: Props) {
  const safe =
    Number.isInteger(value) && value >= QUESTION_COUNT_MIN && value <= QUESTION_COUNT_MAX
      ? value
      : QUESTION_COUNT_DEFAULT;

  return (
    <fieldset className="calibrate-question-count" disabled={disabled}>
      <legend className="calibrate-question-bank__label">{label}</legend>
      <p className="calibrate-question-count__hint">
        Target up to {QUESTION_COUNT_MAX} grounded questions (default {QUESTION_COUNT_DEFAULT}).
      </p>
      <div className="calibrate-question-count__presets" role="group" aria-label={label}>
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={safe === preset ? "is-selected" : ""}
            aria-pressed={safe === preset}
            onClick={() => onChange(preset)}
          >
            {preset}
          </button>
        ))}
      </div>
      <label className="calibrate-question-count__custom" htmlFor={id}>
        <span className="sr-only">Custom count from {QUESTION_COUNT_MIN} to {QUESTION_COUNT_MAX}</span>
        <input
          id={id}
          type="number"
          min={QUESTION_COUNT_MIN}
          max={QUESTION_COUNT_MAX}
          value={safe}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (!Number.isFinite(next)) return;
            onChange(
              Math.min(QUESTION_COUNT_MAX, Math.max(QUESTION_COUNT_MIN, Math.round(next))),
            );
          }}
        />
      </label>
    </fieldset>
  );
}
