import { NextRequest } from "next/server";
import { getStore } from "@/mocks/fixtures/store";
import { jsonResponse, paginate, simulateLatency } from "@/mocks/server/respond";

/** `GET /review/tasks` — queue. Filters: reason_code, risk_tier, class_id,
 *  assigned_to, confidence_lt (docs/api.md §Review). */
export async function GET(request: NextRequest) {
  await simulateLatency(request, "read");
  const params = request.nextUrl.searchParams;
  let items = getStore().reviewTasks;

  // The queue only ever shows open work by default.
  items = items.filter((t) => t.state === "open");

  const reasonCode = params.get("reason_code");
  if (reasonCode) items = items.filter((t) => t.reason_code === reasonCode);

  const riskTier = params.get("risk_tier");
  if (riskTier !== null) items = items.filter((t) => t.risk_tier === Number(riskTier));

  const assignedTo = params.get("assigned_to");
  if (assignedTo) items = items.filter((t) => t.assigned_to === assignedTo);

  const confidenceLt = params.get("confidence_lt");
  if (confidenceLt) {
    const threshold = Number(confidenceLt);
    items = items.filter((t) => (t.proposed_value?.confidence ?? 0) < threshold);
  }

  return jsonResponse(request, paginate(items, request));
}
