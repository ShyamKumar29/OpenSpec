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

const MAX_TICKS = 5;
const MAX_STAGE_WAIT_MS = 2000; // caps a full run to a demo-length narration, not the fixture's literal timing

/** Rounds to 3 decimals — matches the precision every cost figure in the fixtures already
 *  uses (e.g. 0.038), so a tick's fractional cost never grows spurious digits. */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * `GET /runs/{id}/events` — SSE stream of stage events (docs/api.md §Runs & progress).
 * Replays the run's scripted `stages` array as real `event: stage` frames. Stages with
 * more than one unit of work (EXT/VER/VAL/NRM/CNF — per-attribute stages) are split into
 * a handful of intermediate `running` ticks before their final frame, so a multi-attribute
 * stage narrates progressively (`▓▓▓▓▓▓▓▓▓░░░ 17/22`, per docs/06-frontend.md §3.4) instead
 * of jumping straight from 0 to done — this is what makes the mock behave like a live
 * event stream rather than a sequence of static snapshots, while the total wall-clock
 * budget per stage (capped at `MAX_STAGE_WAIT_MS`) is unchanged from before this was added,
 * so `latency=0` E2E runs and the ~6-25s demo pacing are unaffected. `?latency=0` collapses
 * every frame (ticks included) to immediate delivery.
 */
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

  function frame(payload: unknown): Uint8Array {
    return encoder.encode(`event: stage\ndata: ${JSON.stringify(payload)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      for (const stage of run.stages) {
        const trueDuration = stage.duration_ms ?? 0;
        const trueCost = stage.cost_usd ?? 0;
        const cappedWait = collapse ? 0 : Math.min(trueDuration, MAX_STAGE_WAIT_MS);
        const finalDone = stage.progress_done;

        const canTick = finalDone > 1 && !collapse;
        const steps = canTick ? Math.min(finalDone, MAX_TICKS) : 1;
        const perTickWait = steps > 0 ? cappedWait / steps : 0;

        for (let i = 1; i <= steps; i++) {
          const isLast = i === steps;
          const tickDone = canTick ? Math.round((finalDone * i) / steps) : finalDone;
          const fraction = finalDone > 0 ? tickDone / finalDone : 1;
          controller.enqueue(
            frame({
              record_id: run.record_id,
              stage: stage.stage,
              state: isLast ? stage.state : "running",
              progress: { done: tickDone, total: stage.progress_total },
              duration_ms: isLast ? trueDuration : Math.round(trueDuration * fraction),
              cost_usd: isLast ? trueCost : round3(trueCost * fraction),
            }),
          );
          if (!isLast && perTickWait > 0) {
            await new Promise((resolve) => setTimeout(resolve, perTickWait));
          }
        }

        if (!collapse && steps === 1 && cappedWait > 0) {
          await new Promise((resolve) => setTimeout(resolve, cappedWait));
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
