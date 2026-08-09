import { NextRequest } from "next/server";
import { getStore } from "@/mocks/fixtures/store";
import { buildExplainPayload } from "@/mocks/fixtures/explain";
import { jsonResponse, notFound, simulateLatency } from "@/mocks/server/respond";

/** `GET /attributes/{id}/explain` — the "Why?" panel payload (docs/api.md
 *  §Attribute values): evidence, verification, validation results, transform chain,
 *  confidence signal breakdown, policy note. Payload construction lives in
 *  mocks/fixtures/explain.ts (deterministic, unit-tested) — this route is the thin HTTP
 *  adapter over it, per docs/14-frontend-implementation-plan.md §1 D1. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await simulateLatency(request, "explain");
  const { id } = await params;
  const store = getStore();
  const av = store.attributeValueById.get(id);
  if (!av) return notFound(request, "AttributeValue", id);

  return jsonResponse(request, buildExplainPayload(av, store));
}
