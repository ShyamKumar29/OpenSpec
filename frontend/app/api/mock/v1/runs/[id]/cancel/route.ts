import { NextRequest } from "next/server";
import { getStore } from "@/mocks/fixtures/store";
import { jsonResponse, notFound, simulateLatency } from "@/mocks/server/respond";

/** `POST /runs/{id}/cancel` — cooperative cancel between stages (docs/api.md
 *  §Runs & progress). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await simulateLatency(request, "decision");
  const { id } = await params;
  const run = (getStore().runs as { id: string; status: string }[]).find((r) => r.id === id);
  if (!run) return notFound(request, "Run", id);
  if (run.status === "running" || run.status === "queued") {
    run.status = "cancelled";
  }
  return jsonResponse(request, run);
}
