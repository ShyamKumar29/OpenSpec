import { NextRequest } from "next/server";
import { applyAccept, findOpenTask } from "@/mocks/server/review-actions";
import { jsonResponse, problemResponse, simulateLatency } from "@/mocks/server/respond";

/** `POST /review/tasks/{id}/accept` — accept the proposed value (docs/api.md §Review).
 *  INV-9: Tier 0 attributes can never be accepted this way — only /approve. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await simulateLatency(request, "decision");
  const { id } = await params;
  const lookup = findOpenTask(id);
  if (!lookup.ok) {
    return problemResponse(request, {
      status: lookup.reason === "task_not_found" ? 404 : 409,
      title: "Cannot accept",
      detail: lookup.reason,
      code: lookup.reason.toUpperCase(),
    });
  }
  if (lookup.task.risk_tier === 0) {
    return problemResponse(request, {
      status: 409,
      title: "Tier 0 requires approval",
      detail: "Tier 0 attributes cannot be accepted — use /approve (INV-9).",
      code: "POLICY_BLOCKED",
    });
  }
  applyAccept(lookup.task, lookup.av);
  return jsonResponse(request, { task: lookup.task, attribute_value: lookup.av });
}
