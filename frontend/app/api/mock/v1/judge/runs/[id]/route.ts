import { NextRequest } from "next/server";
import { getStore } from "@/mocks/fixtures/store";
import { jsonResponse, notFound, simulateLatency } from "@/mocks/server/respond";

/** `GET /judge/runs/{id}` — full intermediate output for every stage
 *  (docs/api.md §Judge Mode). Reuses the scripted run objects (each stage already
 *  carries a `note` describing its output) — a fuller per-stage payload is F4 scope. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await simulateLatency(request, "read");
  const { id } = await params;
  const run = (getStore().runs as { id: string; kind: string }[]).find(
    (r) => r.id === id && r.kind === "judge",
  );
  if (!run) return notFound(request, "Judge run", id);
  return jsonResponse(request, run);
}
