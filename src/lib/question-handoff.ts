/**
 * Pure helpers for the generation → Question Bank handoff.
 * Kept free of React so the filter/reconcile rules can be unit-tested.
 */

import { filterBankQuestions, type BankQuestion } from "./question-bank-list";

export type HandoffQuestion = BankQuestion;

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
  return filterBankQuestions(questions, {
    subjectFilter: state.subjectId || "all",
    materialFilter: state.materialFilter,
    typeFilter: state.typeFilter,
    statusFilter: state.statusFilter,
    handoffMaterialId: state.handoffMaterialId,
  });
}

export function countHandoffBatch<T extends HandoffQuestion>(
  questions: T[],
  handoffMaterialId: string | null,
): number {
  if (!handoffMaterialId) return 0;
  return questions.filter((question) => question.materialId === handoffMaterialId).length;
}
