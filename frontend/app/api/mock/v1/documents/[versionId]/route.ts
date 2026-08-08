import { NextRequest } from "next/server";
import { getStore } from "@/mocks/fixtures/store";
import { jsonResponse, notFound, simulateLatency } from "@/mocks/server/respond";

/** `GET /documents/{version_id}` — metadata, parse status, regions summary, plus the
 *  additive `pages` field (per-page pixel dimensions + DPI) agreed in
 *  docs/14-frontend-implementation-plan.md §3 O1 and recorded in docs/api.md. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> },
) {
  await simulateLatency(request, "read");
  const { versionId } = await params;
  const doc = getStore().documentByVersionId.get(versionId);
  if (!doc) return notFound(request, "Document", versionId);
  return jsonResponse(request, doc);
}
