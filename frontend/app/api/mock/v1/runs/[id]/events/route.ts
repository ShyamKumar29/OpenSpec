import { NextRequest } from "next/server";
import { getStore } from "@/mocks/fixtures/store";
import { notFound } from "@/mocks/server/respond";

interface StageExecutionWire {
  stage: string;
  state: string;
  progress_done: number;
  progress_total: number;
  duration_ms: number | null;
  cost_usd: number | null;
}

/** `GET /runs/{id}/events` — SSE stream of stage events (docs/api.md §Runs & progress).
 *  Replays the run's scripted `stages` array as real `event: stage` frames, spaced by
 *  each stage's own `duration_ms` (capped) — a live narration of an already-deterministic
 *  script, not randomness. `?latency=0` collapses all frames immediately for E2E. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = (
    getStore().runs as { id: string; record_id: string | null; stages: StageExecutionWire[] }[]
  ).find((r) => r.id === id);
  if (!run) return notFound(request, "Run", id);

  const collapse =
    request.nextUrl.searchParams.get("latency") === "0" ||
    process.env.NEXT_PUBLIC_MOCK_LATENCY === "0";
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      for (const stage of run.stages) {
        const payload = {
          record_id: run.record_id,
          stage: stage.stage,
          state: stage.state,
          progress: { done: stage.progress_done, total: stage.progress_total },
          duration_ms: stage.duration_ms ?? 0,
          cost_usd: stage.cost_usd ?? 0,
        };
        controller.enqueue(encoder.encode(`event: stage\ndata: ${JSON.stringify(payload)}\n\n`));
        if (!collapse && stage.duration_ms) {
          const waitMs = Math.min(stage.duration_ms, 2000); // cap so a demo run narrates in seconds, not the full pipeline time
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      }
      controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Correlation-Id": request.headers.get("x-correlation-id") ?? "srv_sse",
    },
  });
}
