import { NextRequest } from "next/server";
import { getStore } from "@/mocks/fixtures/store";
import { jsonResponse, notFound, simulateLatency } from "@/mocks/server/respond";

/** `GET /documents/{version_id}/regions` — region tree with bboxes, powers the
 *  highlight overlay (docs/api.md §Documents). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> },
) {
  await simulateLatency(request, "read");
  const { versionId } = await params;
  const store = getStore();
  if (!store.documentByVersionId.has(versionId)) return notFound(request, "Document", versionId);
  const regions = store.regionsByDocument[versionId] ?? [];
  return jsonResponse(request, { regions });
}
