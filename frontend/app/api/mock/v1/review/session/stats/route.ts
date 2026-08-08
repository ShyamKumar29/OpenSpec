import { NextRequest } from "next/server";
import { sessionStats } from "@/mocks/fixtures/aggregates";
import { jsonResponse, simulateLatency } from "@/mocks/server/respond";

/** `GET /review/session/stats` — resolved count, rate/hour, median decision time
 *  (docs/api.md §Review). Powers the throughput meter (docs/06-frontend.md §3.3). */
export async function GET(request: NextRequest) {
  await simulateLatency(request, "read");
  return jsonResponse(request, sessionStats());
}
