import { NextRequest } from "next/server";
import { getStore } from "@/mocks/fixtures/store";
import { jsonResponse, paginate, simulateLatency } from "@/mocks/server/respond";

/** `GET /catalog/pull` — paginated machine-readable pull for downstream systems
 *  (docs/api.md §Export). */
export async function GET(request: NextRequest) {
  await simulateLatency(request, "read");
  return jsonResponse(request, paginate(getStore().records, request));
}
