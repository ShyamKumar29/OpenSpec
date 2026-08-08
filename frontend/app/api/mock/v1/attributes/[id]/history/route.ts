import { NextRequest } from "next/server";
import { getStore } from "@/mocks/fixtures/store";
import { jsonResponse, notFound, simulateLatency } from "@/mocks/server/respond";

/** `GET /attributes/{id}/history` — full supersession chain + audit events
 *  (docs/api.md §Attribute values). F0.5's fixture set doesn't generate a multi-version
 *  supersession chain per value (INV-8 append-only history is real backend behaviour,
 *  F1+ concern) — this returns the current value as a single-entry chain, which is a
 *  valid (if short) history. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await simulateLatency(request, "read");
  const { id } = await params;
  const av = getStore().attributeValueById.get(id);
  if (!av) return notFound(request, "AttributeValue", id);

  return jsonResponse(request, {
    chain: [{ ...av, is_current: true, superseded_by_id: null }],
    audit_events: [
      {
        id: `audit_${id}`,
        entity_type: "attribute_value",
        entity_id: id,
        action: "created",
        actor_kind: "pipeline",
        occurred_at: av.created_at,
      },
    ],
  });
}
