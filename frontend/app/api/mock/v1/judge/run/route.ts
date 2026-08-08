import { NextRequest } from "next/server";
import { jsonResponse, problemResponse, simulateLatency } from "@/mocks/server/respond";
import { JUDGE_SCENARIOS } from "@/lib/contracts/run";

const SCENARIO_RUN_ID: Record<(typeof JUDGE_SCENARIOS)[number], string> = {
  success: "judge_run_success",
  abstain: "judge_run_abstain",
  rejected: "judge_run_rejected",
};

/** `POST /judge/run` — `{ mpn, description, document? }` -> 202 + run_id. Isolated from
 *  catalog data (FR-JDG-5); hard timeout with partial results (FR-JDG-4)
 *  (docs/api.md §Judge Mode). The mock routes to one of the three scripted scenarios —
 *  pass `scenario` explicitly (what the F4 UI's three demo buttons will do), or the mpn
 *  is matched against the canonical demo record for a reasonable default. */
export async function POST(request: NextRequest) {
  await simulateLatency(request, "read");
  const body = (await request.json().catch(() => ({}))) as {
    mpn?: string;
    description?: string;
    scenario?: string;
  };

  if (!body.mpn && !body.description) {
    return problemResponse(request, {
      status: 422,
      title: "Validation failed",
      detail: "Body must include 'mpn' or 'description'.",
      code: "VALIDATION_FAILED",
    });
  }

  const scenario = JUDGE_SCENARIOS.includes(body.scenario as (typeof JUDGE_SCENARIOS)[number])
    ? (body.scenario as (typeof JUDGE_SCENARIOS)[number])
    : body.mpn === "ABC-123"
      ? "success"
      : "abstain";

  return jsonResponse(request, { run_id: SCENARIO_RUN_ID[scenario] }, { status: 202 });
}
