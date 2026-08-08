import { NextRequest } from "next/server";
import { jsonResponse, problemResponse, simulateLatency } from "@/mocks/server/respond";

const VALID_TARGETS = ["csv", "json", "xlsx", "cx1"];
const VALID_POLICIES = ["auto_accepted_only", "human_approved_only", "all_with_flags"];

/** `POST /export` — `{ target, filter, include_provenance, policy }` -> 202 + export_id
 *  (docs/api.md §Export). */
export async function POST(request: NextRequest) {
  await simulateLatency(request, "read");
  const body = (await request.json().catch(() => ({}))) as { target?: string; policy?: string };
  if (!body.target || !VALID_TARGETS.includes(body.target)) {
    return problemResponse(request, {
      status: 422,
      title: "Validation failed",
      detail: `'target' must be one of ${VALID_TARGETS.join(", ")}.`,
      code: "VALIDATION_FAILED",
    });
  }
  if (body.policy && !VALID_POLICIES.includes(body.policy)) {
    return problemResponse(request, {
      status: 422,
      title: "Validation failed",
      detail: `'policy' must be one of ${VALID_POLICIES.join(", ")}.`,
      code: "VALIDATION_FAILED",
    });
  }
  return jsonResponse(request, { export_id: `export_${Date.now().toString(36)}` }, { status: 202 });
}
