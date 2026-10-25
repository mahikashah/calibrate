/**
 * Pure helpers for Question Bank filtering + pagination.
 * Filter first, then paginate — never the reverse.
 */

export const QUESTION_BANK_PAGE_SIZE = 12;

export type BankQuestion = {
  id: string;
  subjectId: string;
  materialId?: string | null;
  type: string;
  status?: string | null;
};

export type BankFilterState = {
  subjectFilter: string; // "all" | subjectId
  materialFilter: string; // "all" | materialId
  typeFilter: string;
  statusFilter: string;
  handoffMaterialId: string | null;
};

export function typeMatches(questionType: string, typeFilter: string): boolean {
  if (typeFilter === "all") return true;
  if (typeFilter === "active_recall") {
    return questionType === "active_recall" || questionType === "recall";
  }
  if (typeFilter === "fill_in_blank") {
    return questionType === "fill_in_blank" || questionType === "cloze";
  }
  return questionType === typeFilter;
}

export function filterBankQuestions<T extends BankQuestion>(
  questions: T[],
  state: BankFilterState,
): T[] {
  const statusOk = (question: T) =>
    state.statusFilter === "all" || (question.status ?? "approved") === state.statusFilter;

  if (state.handoffMaterialId) {
    return questions.filter(
      (question) =>
        question.materialId === state.handoffMaterialId &&
        typeMatches(question.type, state.typeFilter) &&
        statusOk(question),
    );
  }

  return questions.filter((question) => {
    const subjectOk =
      state.subjectFilter === "all" ||
      !state.subjectFilter ||
      question.subjectId === state.subjectFilter;
    const materialOk =
      state.materialFilter === "all" || question.materialId === state.materialFilter;
    return (
      subjectOk &&
      materialOk &&
      typeMatches(question.type, state.typeFilter) &&
      statusOk(question)
    );
  });
}

export type PageSlice<T> = {
  items: T[];
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
};

export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize: number = QUESTION_BANK_PAGE_SIZE,
): PageSlice<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);
  return {
    items: pageItems,
    page: safePage,
    totalPages,
    from: total === 0 ? 0 : start + 1,
    to: start + pageItems.length,
    total,
  };
}

export function filtersAreDefault(state: Omit<BankFilterState, "handoffMaterialId">): boolean {
  return (
    state.subjectFilter === "all" &&
    state.materialFilter === "all" &&
    state.typeFilter === "all" &&
    state.statusFilter === "all"
  );
}
