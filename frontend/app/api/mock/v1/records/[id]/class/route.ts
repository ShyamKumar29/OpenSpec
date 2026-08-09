import { NextRequest } from "next/server";
import { getStore, stripInternalFields } from "@/mocks/fixtures/store";
import { jsonResponse, notFound, problemResponse, simulateLatency } from "@/mocks/server/respond";
import { TAXONOMY } from "@/mocks/fixtures/taxonomy";

/** `PATCH /records/{id}/class` — manual reclassification, writes `HUMAN` provenance
 *  (docs/api.md §Records). Genuinely mutates the in-memory store for this session.
 *  `attributes` is composed live the same way `GET /records/{id}` does — this route
 *  also returns a full `RecordDetail`, so it needs the same non-stale field. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await simulateLatency(request, "decision");
  const { id } = await params;
  const store = getStore();
  const detail = store.recordDetails.get(id);
  if (!detail) return notFound(request, "Record", id);

  const body = (await request.json().catch(() => null)) as { class_code?: string } | null;
  const classCode = body?.class_code;
  const target = TAXONOMY.find((c) => c.code === classCode);
  if (!classCode || !target) {
    return problemResponse(request, {
      status: 422,
      title: "Validation failed",
      detail: "Body must include a valid 'class_code'.",
      code: "VALIDATION_FAILED",
    });
  }

  detail.class = {
    id: target.id,
    code: target.code,
    name: target.name,
    confidence: 1,
    provenance_kind: "HUMAN",
    signal: "manual_reclassification",
  };

  const attributes = (store.attrsByRecordId.get(id) ?? []).map(stripInternalFields);
  return jsonResponse(request, { ...detail, attributes });
}
