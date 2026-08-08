import { NextRequest } from "next/server";
import { catalogHealth } from "@/mocks/fixtures/aggregates";
import { jsonResponse, simulateLatency } from "@/mocks/server/respond";

/** `GET /metrics/catalog-health` — completeness, STP, unknown-reason breakdown
 *  (docs/api.md §Evaluation & dashboard). */
export async function GET(request: NextRequest) {
  await simulateLatency(request, "read");
  return jsonResponse(request, catalogHealth());
}
