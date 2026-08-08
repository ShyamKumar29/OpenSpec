import { NextRequest } from "next/server";
import { getStore } from "@/mocks/fixtures/store";
import { jsonResponse, notFound, simulateLatency } from "@/mocks/server/respond";

/** `GET /runs/{id}` — run status, per-stage progress, cost, token totals
 *  (docs/api.md §Runs & progress). Judge runs are also served here — `/judge/runs/{id}`
 *  is a distinct route (docs/api.md §Judge Mode) but reads from the same run objects. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await simulateLatency(request, "read");
  const { id } = await params;
  const run = (getStore().runs as { id: string }[]).find((r) => r.id === id);
  if (!run) return notFound(request, "Run", id);
  return jsonResponse(request, run);
}
