import { NextRequest } from "next/server";
import { throughput } from "@/mocks/fixtures/aggregates";
import { jsonResponse, simulateLatency } from "@/mocks/server/respond";

/** `GET /metrics/throughput` — SKUs/hr, cost/SKU, reviewer rate vs baseline
 *  (docs/api.md §Evaluation & dashboard). */
export async function GET(request: NextRequest) {
  await simulateLatency(request, "read");
  return jsonResponse(request, throughput());
}
