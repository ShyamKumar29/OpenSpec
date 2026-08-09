/**
 * "Bulk: apply to N similar tasks in this document" (docs/06-frontend.md §3.3 decision
 * bar). The fixture's `similarTaskCount` field (mocks/fixtures/review-tasks.ts) is
 * flavour-only — a random 0-14 with no underlying grouping — so it cannot be used to
 * find the actual task ids to apply a bulk decision to. This module defines "similar"
 * for real, against whatever tasks are currently loaded in the reviewer's queue: same
 * reason code (same tab), same source document, same attribute — the concrete case the
 * wireframe describes (a wrong-row binding that recurs across every SKU in one family
 * table). Pure and deterministic so it's unit-testable without a store.
 */
import type { ReviewTask } from "@/lib/contracts/review";

export function findSimilarTasks(current: ReviewTask, pool: ReviewTask[]): ReviewTask[] {
  if (!current.documentVersionId) return [];
  return pool.filter(
    (task) =>
      task.id !== current.id &&
      task.state === "open" &&
      task.reasonCode === current.reasonCode &&
      task.attributeCode === current.attributeCode &&
      task.documentVersionId === current.documentVersionId,
  );
}
