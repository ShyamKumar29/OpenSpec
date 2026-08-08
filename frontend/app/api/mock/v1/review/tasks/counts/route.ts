import { NextRequest } from "next/server";
import { reviewCounts } from "@/mocks/fixtures/aggregates";
import { jsonResponse, simulateLatency } from "@/mocks/server/respond";

/** `GET /review/tasks/counts` — counts per reason code, powers the queue tabs
 *  (docs/api.md §Review). Computed from the live task list (risk F-3). */
export async function GET(request: NextRequest) {
  await simulateLatency(request, "read");
  return jsonResponse(request, reviewCounts());
}
