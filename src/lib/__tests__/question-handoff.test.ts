import { describe, expect, it } from "vitest";
import {
  countHandoffBatch,
  handoffFilterReset,
  selectReviewQuestions,
  type HandoffQuestion,
} from "../question-handoff";

const batch: HandoffQuestion[] = [
  {
    id: "q1",
    subjectId: "sub-bio-ii",
    materialId: "mat-oxygen",
    type: "active_recall",
    status: "generated",
  },
  {
    id: "q2",
    subjectId: "sub-bio-ii",
    materialId: "mat-oxygen",
    type: "mcq",
    status: "generated",
  },
  {
    id: "q3",
    subjectId: "sub-bio-ii",
    materialId: "mat-oxygen",
    type: "feynman",
    status: "generated",
  },
  {
    id: "q4",
    subjectId: "sub-bio",
    materialId: "mat-cells",
    type: "active_recall",
    status: "generated",
  },
];

describe("generation → Question Bank handoff filters", () => {
  it("forces All type/status filters onto the handed-off material", () => {
    expect(handoffFilterReset("sub-bio-ii", "mat-oxygen")).toEqual({
      subjectId: "sub-bio-ii",
      materialFilter: "mat-oxygen",
      typeFilter: "all",
      statusFilter: "all",
      handoffMaterialId: "mat-oxygen",
    });
  });

  it("shows the fresh generated batch even when materialFilter state is stale", () => {
    const staleState = {
      subjectId: "sub-bio",
      materialFilter: "mat-cells",
      typeFilter: "mcq",
      statusFilter: "approved",
      handoffMaterialId: "mat-oxygen",
    };
    // Handoff still wins for material identity; type/status come from forced defaults in the page.
    const withDefaults = {
      ...staleState,
      typeFilter: "all",
      statusFilter: "all",
    };
    const visible = selectReviewQuestions(batch, withDefaults);
    expect(visible.map((question) => question.id)).toEqual(["q1", "q2", "q3"]);
    expect(visible.every((question) => question.materialId === "mat-oxygen")).toBe(true);
    expect(visible.some((question) => question.materialId === "mat-cells")).toBe(false);
  });

  it("does not use material title — only exact materialId", () => {
    const visible = selectReviewQuestions(batch, handoffFilterReset("sub-bio-ii", "mat-oxygen"));
    expect(countHandoffBatch(batch, "mat-oxygen")).toBe(3);
    expect(visible).toHaveLength(3);
    expect(countHandoffBatch(batch, "mat-cells")).toBe(1);
  });

  it("keeps normal Question Bank filtering when there is no handoff", () => {
    const visible = selectReviewQuestions(batch, {
      subjectId: "sub-bio",
      materialFilter: "mat-cells",
      typeFilter: "all",
      statusFilter: "all",
      handoffMaterialId: null,
    });
    expect(visible.map((question) => question.id)).toEqual(["q4"]);
  });

  it("does not hide Generated questions during handoff when status filter is All", () => {
    const visible = selectReviewQuestions(batch, handoffFilterReset("sub-bio-ii", "mat-oxygen"));
    expect(visible.every((question) => question.status === "generated")).toBe(true);
    expect(visible).toHaveLength(3);
  });
});
