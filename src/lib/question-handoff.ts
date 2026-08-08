/**
 * Pure helpers for the generation → Question Bank handoff.
 * Kept free of React so the filter/reconcile rules can be unit-tested.
 */

export type HandoffQuestion = {
  id: string;
  subjectId: string;
  materialId?: string | null;
  type: string;
  status?: string | null;
};

export type HandoffFilterState = {
  subjectId: string;
  materialFilter: string;
  typeFilter: string;
  statusFilter: string;
  handoffMaterialId: string | null;
};

/** Filters that must be forced when arriving from generation. */
export function handoffFilterReset(subjectId: string, materialId: string): HandoffFilterState {
  return {
    subjectId,
    materialFilter: materialId,
    typeFilter: "all",
    statusFilter: "all",
    handoffMaterialId: materialId,
  };
}

/**
 * Questions shown in the review list.
 * During an active generation handoff, the handed-off materialId is authoritative
 * so a stale material/subject filter cannot hide the new batch.
 */
export function selectReviewQuestions<T extends HandoffQuestion>(
  questions: T[],
  state: HandoffFilterState,
): T[] {
  const typeOk = (question: T) => state.typeFilter === "all" || question.type === state.typeFilter;
  const statusOk = (question: T) =>
    state.statusFilter === "all" || (question.status ?? "approved") === state.statusFilter;

  if (state.handoffMaterialId) {
    return questions.filter(
      (question) =>
        question.materialId === state.handoffMaterialId && typeOk(question) && statusOk(question),
    );
  }

  return questions.filter(
    (question) =>
      (!state.subjectId || question.subjectId === state.subjectId) &&
      typeOk(question) &&
      statusOk(question) &&
      (state.materialFilter === "all" || question.materialId === state.materialFilter),
  );
}

export function countHandoffBatch<T extends HandoffQuestion>(
  questions: T[],
  handoffMaterialId: string | null,
): number {
  if (!handoffMaterialId) return 0;
  return questions.filter((question) => question.materialId === handoffMaterialId).length;
}
