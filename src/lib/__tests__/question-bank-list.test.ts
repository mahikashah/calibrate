import { describe, expect, it } from "vitest";
import {
  QUESTION_BANK_PAGE_SIZE,
  filterBankQuestions,
  filtersAreDefault,
  paginateItems,
  type BankQuestion,
} from "../question-bank-list";
import { handoffFilterReset, selectReviewQuestions } from "../question-handoff";

const questions: BankQuestion[] = Array.from({ length: 48 }, (_, index) => ({
  id: `q${index + 1}`,
  subjectId: index < 17 ? "sub-bio" : index < 30 ? "sub-calc" : "sub-hist",
  materialId: index < 17 ? "mat-bio" : index < 30 ? "mat-calc" : "mat-hist",
  type: index % 2 === 0 ? "active_recall" : "mcq",
  status: "generated",
}));

describe("Question Bank filter + pagination", () => {
  it("defaults to showing all subjects when subjectFilter is all", () => {
    const visible = filterBankQuestions(questions, {
      subjectFilter: "all",
      materialFilter: "all",
      typeFilter: "all",
      statusFilter: "all",
      handoffMaterialId: null,
    });
    expect(visible).toHaveLength(48);
  });

  it("filters by subject before pagination", () => {
    const filtered = filterBankQuestions(questions, {
      subjectFilter: "sub-bio",
      materialFilter: "all",
      typeFilter: "all",
      statusFilter: "all",
      handoffMaterialId: null,
    });
    expect(filtered).toHaveLength(17);
    const page1 = paginateItems(filtered, 1, QUESTION_BANK_PAGE_SIZE);
    expect(page1.items).toHaveLength(12);
    expect(page1.from).toBe(1);
    expect(page1.to).toBe(12);
    expect(page1.totalPages).toBe(2);
    const page2 = paginateItems(filtered, 2, QUESTION_BANK_PAGE_SIZE);
    expect(page2.items).toHaveLength(5);
    expect(page2.from).toBe(13);
    expect(page2.to).toBe(17);
  });

  it("makes every record reachable across pages", () => {
    const filtered = filterBankQuestions(questions, {
      subjectFilter: "all",
      materialFilter: "all",
      typeFilter: "all",
      statusFilter: "all",
      handoffMaterialId: null,
    });
    const seen = new Set<string>();
    for (let page = 1; page <= 4; page += 1) {
      for (const item of paginateItems(filtered, page).items) seen.add(item.id);
    }
    expect(seen.size).toBe(48);
  });

  it("clamps an out-of-range page back into bounds", () => {
    const page = paginateItems(questions.slice(0, 5), 9, 12);
    expect(page.page).toBe(1);
    expect(page.items).toHaveLength(5);
  });

  it("treats clear-filters defaults as inactive", () => {
    expect(
      filtersAreDefault({
        subjectFilter: "all",
        materialFilter: "all",
        typeFilter: "all",
        statusFilter: "all",
      }),
    ).toBe(true);
  });

  it("keeps generation handoff on page-1-sized batches", () => {
    const batch = questions.slice(0, 8).map((question) => ({
      ...question,
      materialId: "mat-new",
      subjectId: "sub-bio",
    }));
    const reset = handoffFilterReset("sub-bio", "mat-new");
    const visible = selectReviewQuestions(batch, reset);
    expect(visible).toHaveLength(8);
    const page = paginateItems(visible, 4); // stale page must clamp to 1
    expect(page.page).toBe(1);
    expect(page.items).toHaveLength(8);
  });

  it("matches legacy recall under Active Recall filter", () => {
    const mixed: BankQuestion[] = [
      { id: "a", subjectId: "s", materialId: "m", type: "recall", status: "generated" },
      { id: "b", subjectId: "s", materialId: "m", type: "mcq", status: "generated" },
    ];
    const visible = filterBankQuestions(mixed, {
      subjectFilter: "all",
      materialFilter: "all",
      typeFilter: "active_recall",
      statusFilter: "all",
      handoffMaterialId: null,
    });
    expect(visible.map((q) => q.id)).toEqual(["a"]);
  });
});
