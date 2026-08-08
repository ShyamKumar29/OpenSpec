import { NextRequest } from "next/server";
import { applyAccept, applyReject, findOpenTask } from "@/mocks/server/review-actions";
import { jsonResponse, problemResponse, simulateLatency } from "@/mocks/server/respond";

/** `POST /review/bulk` — `{ task_ids[], action, value? }` with a confirmation summary
 *  (docs/api.md §Review). Supports accept/reject; correct/approve are single-task-only
 *  in this mock (bulk approve of Tier 0 items is a policy decision worth a real
 *  confirmation flow, not stubbed here). */
export async function POST(request: NextRequest) {
  await simulateLatency(request, "decision");
  const body = (await request.json().catch(() => ({}))) as {
    task_ids?: string[];
    action?: "accept" | "reject";
  };
  if (!body.task_ids?.length || !body.action) {
    return problemResponse(request, {
      status: 422,
      title: "Validation failed",
      detail: "Body must include 'task_ids' and 'action'.",
      code: "VALIDATION_FAILED",
    });
  }

  let applied = 0;
  let skipped = 0;
  for (const taskId of body.task_ids) {
    const lookup = findOpenTask(taskId);
    if (!lookup.ok) {
      skipped++;
      continue;
    }
    if (body.action === "accept") {
      if (lookup.task.risk_tier === 0) {
        skipped++;
        continue;
      }
      applyAccept(lookup.task, lookup.av);
    } else {
      applyReject(lookup.task, lookup.av, "VERIFICATION_FAILED");
    }
    applied++;
  }

  return jsonResponse(request, { applied, skipped, total: body.task_ids.length });
}
