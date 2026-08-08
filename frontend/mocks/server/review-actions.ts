/**
 * Shared mutation logic for the four review decisions (docs/api.md §Review). Genuinely
 * mutates the in-memory fixture store for the life of the dev server process — a real
 * mock, not a facade. Simplification, stated plainly: a real backend creates a NEW
 * `attribute_value` row and marks the old one `is_current=false` (append-only,
 * docs/04-data-model.md §5); this mock mutates the existing row in place. That is
 * enough to exercise the UI (F5) but is not itself an append-only audit trail.
 */
import { getStore } from "@/mocks/fixtures/store";

export type ReviewTaskLookup =
  | { ok: true; task: Record<string, unknown>; av: Record<string, unknown> }
  | { ok: false; reason: "task_not_found" | "already_resolved" | "attribute_value_not_found" };

export function findOpenTask(taskId: string): ReviewTaskLookup {
  const store = getStore();
  const task = store.reviewTasks.find((t) => (t as { id: string }).id === taskId) as
    Record<string, unknown> | undefined;
  if (!task) return { ok: false, reason: "task_not_found" };
  if (task.state !== "open") return { ok: false, reason: "already_resolved" };
  const av = store.attributeValueById.get(task.attribute_value_id as string);
  if (!av) return { ok: false, reason: "attribute_value_not_found" };
  return { ok: true, task, av: av as unknown as Record<string, unknown> };
}

function resolveTask(task: Record<string, unknown>): void {
  task.state = "resolved";
  task.closed_at = new Date().toISOString();
}

export function applyAccept(task: Record<string, unknown>, av: Record<string, unknown>): void {
  av.status = "ACCEPTED";
  resolveTask(task);
}

export function applyApprove(task: Record<string, unknown>, av: Record<string, unknown>): void {
  av.status = "ACCEPTED"; // Tier-0 sign-off — a human approved it, it is now current.
  resolveTask(task);
}

export function applyReject(
  task: Record<string, unknown>,
  av: Record<string, unknown>,
  reason: string,
): void {
  av.status = "UNKNOWN";
  av.unknown_reason = reason;
  av.value_display = null;
  av.value_canonical = null;
  av.value_raw = null;
  av.provenance_kind = null;
  av.confidence = null;
  av.evidence = [];
  av.verification = null;
  resolveTask(task);
}

export function applyCorrect(
  task: Record<string, unknown>,
  av: Record<string, unknown>,
  value: string,
  reason: string,
): void {
  av.status = "ACCEPTED";
  av.value_display = value;
  av.value_raw = value;
  av.value_canonical = { corrected: value };
  av.provenance_kind = "HUMAN";
  av.confidence = 1;
  av.verification = {
    verdict: "ENTAILED",
    deterministic_check: "exact",
    rationale: `Corrected by reviewer: ${reason}`,
    verifier_model: "human",
  };
  resolveTask(task);
}
