import { NextRequest } from "next/server";
import { getStore } from "@/mocks/fixtures/store";
import { jsonResponse, notFound, simulateLatency } from "@/mocks/server/respond";

/** `POST /records/{id}/bindings` — manually attach a document/region, `HUMAN`
 *  provenance (docs/api.md §Documents). Stubbed: acknowledges without mutating the
 *  binding list — full binding-editor UI is out of scope before F2. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await simulateLatency(request, "decision");
  const { id } = await params;
  const detail = getStore().recordDetails.get(id);
  if (!detail) return notFound(request, "Record", id);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  return jsonResponse(
    request,
    {
      id: `binding_${Date.now().toString(36)}`,
      document_version_id: body.document_version_id ?? null,
      region_id: body.region_id ?? null,
      confidence: 1,
      signals: { manual: true },
    },
    { status: 201 },
  );
}
