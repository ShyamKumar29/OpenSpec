import { NextRequest } from "next/server";
import { getStore } from "@/mocks/fixtures/store";
import { jsonResponse, notFound, simulateLatency } from "@/mocks/server/respond";

/** `POST /records/{id}/enrich` — docs/api.md §Records. Body: `{ from_stage?, force? }`.
 *  Stubbed for F0.5: acknowledges and points at a scripted run rather than mutating
 *  the record — Judge Mode / Re-enrich wiring lands in F4/F1. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await simulateLatency(request, "read");
  const { id } = await params;
  if (!getStore().recordDetails.has(id)) return notFound(request, "Record", id);
  return jsonResponse(request, { run_id: "run_batch_in_flight" }, { status: 202 });
}
