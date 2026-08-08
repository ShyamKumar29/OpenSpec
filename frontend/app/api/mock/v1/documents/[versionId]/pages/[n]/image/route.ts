import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/mocks/fixtures/store";
import { notFound, simulateLatency } from "@/mocks/server/respond";

/** `GET /documents/{version_id}/pages/{n}/image` — pre-rendered page image, cached,
 *  fixed DPI (docs/api.md §Documents; ADR-0012). The mock serves the statically
 *  generated SVG committed under public/mock/pages/ (docs §4.2 C4) — a redirect, so the
 *  asset itself is served by Next's static file layer like a real cached image would be. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string; n: string }> },
) {
  await simulateLatency(request, "asset");
  const { versionId, n } = await params;
  const page = Number(n);
  const exists = getStore().pages.some((p) => p.documentVersionId === versionId && p.page === page);
  if (!exists) return notFound(request, "Document page image", `${versionId}/${n}`);
  return NextResponse.redirect(new URL(`/mock/pages/${versionId}/${page}.svg`, request.url));
}
