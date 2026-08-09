import { NextRequest } from "next/server";
import { getStore, stripInternalFields } from "@/mocks/fixtures/store";
import { jsonResponse, notFound, simulateLatency } from "@/mocks/server/respond";

/** `GET /records/{id}` — docs/api.md §Records. `attributes` is composed fresh from the
 *  store's live per-record map on every request (not read off the frozen `recordDetails`
 *  snapshot) so a review decision (accept/reject/correct/approve) is reflected here
 *  immediately — required for the catalog/record-detail page to reconcile with the
 *  review queue rather than showing a pre-decision status forever. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await simulateLatency(request, "read");
  const { id } = await params;
  const store = getStore();
  const detail = store.recordDetails.get(id);
  if (!detail) return notFound(request, "Record", id);
  const attributes = (store.attrsByRecordId.get(id) ?? []).map(stripInternalFields);
  return jsonResponse(request, { ...detail, attributes });
}

/** `PATCH /records/{id}/class` lives at its own route; this file only handles GET. */
