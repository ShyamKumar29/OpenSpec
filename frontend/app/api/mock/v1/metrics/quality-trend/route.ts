import { NextRequest } from "next/server";
import { qualityTrend } from "@/mocks/fixtures/aggregates";
import { jsonResponse, simulateLatency } from "@/mocks/server/respond";

/** `GET /metrics/quality-trend` — metric series over eval runs (docs/api.md
 *  §Evaluation & dashboard). */
export async function GET(request: NextRequest) {
  await simulateLatency(request, "read");
  return jsonResponse(request, qualityTrend());
}
