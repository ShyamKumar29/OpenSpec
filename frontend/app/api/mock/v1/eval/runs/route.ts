import { NextRequest } from "next/server";
import { getStore } from "@/mocks/fixtures/store";
import { jsonResponse, simulateLatency } from "@/mocks/server/respond";

/** `GET /eval/runs` — history with metric deltas (docs/api.md §Evaluation & dashboard). */
export async function GET(request: NextRequest) {
  await simulateLatency(request, "read");
  return jsonResponse(request, { items: getStore().evalRuns.summaries });
}

/** `POST /eval/runs` — trigger an evaluation run. Stubbed: acknowledges only; running
 *  the harness against the gold set is a backend concern (docs/09-testing.md §6). */
export async function POST(request: NextRequest) {
  await simulateLatency(request, "read");
  const latest = getStore().evalRuns.summaries.at(-1) as { id: string } | undefined;
  return jsonResponse(request, { eval_run_id: latest?.id ?? "eval_run_5" }, { status: 202 });
}
