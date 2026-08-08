import { NextRequest } from "next/server";
import { getStore } from "@/mocks/fixtures/store";
import { jsonResponse, notFound, simulateLatency } from "@/mocks/server/respond";

/** `GET /eval/runs/{id}` — metrics with CIs, per-slice breakdown, frontier + reliability
 *  data, ablation table (docs/api.md §Evaluation & dashboard). Only the most recent run
 *  carries the full detail payload in this fixture set (mocks/fixtures/eval-runs.ts). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await simulateLatency(request, "read");
  const { id } = await params;
  const store = getStore();
  const detail = store.evalRuns.details[id];
  if (detail) return jsonResponse(request, detail);

  const summary = (store.evalRuns.summaries as { id: string }[]).find((r) => r.id === id);
  if (!summary) return notFound(request, "Eval run", id);
  // Historical runs without a full detail payload still return a valid (empty-slice) shape.
  return jsonResponse(request, {
    ...summary,
    slice_metrics: [],
    frontier: [],
    reliability: [],
    ablation: [],
  });
}
