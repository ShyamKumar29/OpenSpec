import { NextRequest } from "next/server";
import { applyReject, findOpenTask } from "@/mocks/server/review-actions";
import { jsonResponse, problemResponse, simulateLatency } from "@/mocks/server/respond";
import { UNKNOWN_REASONS } from "@/lib/contracts/attribute-value";

/** `POST /review/tasks/{id}/reject` — reject to `Unknown` with an optional reason
 *  (docs/api.md §Review). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await simulateLatency(request, "decision");
  const { id } = await params;
  const lookup = findOpenTask(id);
  if (!lookup.ok) {
    return problemResponse(request, {
      status: lookup.reason === "task_not_found" ? 404 : 409,
      title: "Cannot reject",
      detail: lookup.reason,
      code: lookup.reason.toUpperCase(),
    });
  }
  const body = (await request.json().catch(() => ({}))) as { reason?: string };
  const reason = UNKNOWN_REASONS.includes(body.reason as (typeof UNKNOWN_REASONS)[number])
    ? (body.reason as string)
    : "VERIFICATION_FAILED";
  applyReject(lookup.task, lookup.av, reason);
  return jsonResponse(request, { task: lookup.task, attribute_value: lookup.av });
}
