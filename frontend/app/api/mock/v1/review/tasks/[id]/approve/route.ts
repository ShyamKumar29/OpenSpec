import { NextRequest } from "next/server";
import { applyApprove, findOpenTask } from "@/mocks/server/review-actions";
import { jsonResponse, problemResponse, simulateLatency } from "@/mocks/server/respond";

/** `POST /review/tasks/{id}/approve` — Tier-0 approval, role `approver` only
 *  (docs/api.md §Review). No auth in the mock, so the role check is a documented gap
 *  (`is_mandatory` role gating is a Track A UI concern, not simulated server-side here). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await simulateLatency(request, "decision");
  const { id } = await params;
  const lookup = findOpenTask(id);
  if (!lookup.ok) {
    return problemResponse(request, {
      status: lookup.reason === "task_not_found" ? 404 : 409,
      title: "Cannot approve",
      detail: lookup.reason,
      code: lookup.reason.toUpperCase(),
    });
  }
  if (lookup.task.risk_tier !== 0) {
    return problemResponse(request, {
      status: 409,
      title: "Not a Tier 0 attribute",
      detail: "Only Tier 0 attributes go through /approve — use /accept.",
      code: "POLICY_BLOCKED",
    });
  }
  applyApprove(lookup.task, lookup.av);
  return jsonResponse(request, { task: lookup.task, attribute_value: lookup.av });
}
