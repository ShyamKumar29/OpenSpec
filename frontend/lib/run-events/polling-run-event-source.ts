"use client";

/**
 * The polling fallback (docs/api.md risk M3: "SSE unreliable across hosting boundaries →
 * polling fallback on the same endpoint shape"). Repeatedly reads `GET /runs/{id}` — the
 * same resource the SSE stream narrates — and diffs consecutive snapshots into the same
 * `stage` events the SSE transport would have delivered, so `useRunStream` cannot tell
 * the two transports apart. `createRunEventSource` selects this automatically when
 * `EventSource` is unavailable; it can also be forced for tests.
 */
import { apiFetch } from "@/lib/api/client";
import {
  runWireSchema,
  type RunWire,
  type StageEvent,
  type StageExecutionWire,
} from "@/lib/contracts/run";
import type { RunEventSource, RunEventSourceHandlers } from "./types";

const POLL_INTERVAL_MS = 400;
const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

function toStageEvent(recordId: string | null, wire: StageExecutionWire): StageEvent {
  return {
    recordId,
    stage: wire.stage,
    state: wire.state,
    progress: { done: wire.progress_done, total: wire.progress_total },
    durationMs: wire.duration_ms ?? 0,
    costUsd: wire.cost_usd ?? 0,
  };
}

function stageSignature(wire: StageExecutionWire): string {
  return `${wire.state}:${wire.progress_done}:${wire.progress_total}:${wire.duration_ms}:${wire.cost_usd}`;
}

export function createPollingRunEventSource(
  runId: string,
  handlers: RunEventSourceHandlers,
): RunEventSource {
  let closed = false;
  let started = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastSignatures = new Map<string, string>();

  async function tick() {
    if (closed) return;
    try {
      const wire = runWireSchema.parse(await apiFetch<RunWire>(`/runs/${runId}`));
      for (const stage of wire.stages) {
        const sig = stageSignature(stage);
        if (lastSignatures.get(stage.stage) === sig) continue;
        lastSignatures.set(stage.stage, sig);
        handlers.onStage(toStageEvent(wire.record_id, stage));
      }
      if (TERMINAL_STATUSES.has(wire.status)) {
        handlers.onDone();
        close();
        return;
      }
    } catch (err) {
      if (closed) return;
      handlers.onError(err instanceof Error ? err : new Error("Polling fallback failed"));
      close();
      return;
    }
    if (!closed) timer = setTimeout(tick, POLL_INTERVAL_MS);
  }

  function connect() {
    if (started || closed) return; // idempotent — a closed instance never reconnects
    started = true;
    lastSignatures = new Map();
    // Deferred via the same `timer` the recurring ticks use (rather than an immediate
    // call) so `connect()` followed synchronously by `close()` is guaranteed to fetch
    // zero times — one scheduling path for every tick, not a special-cased first one.
    timer = setTimeout(tick, 0);
  }

  function close() {
    closed = true;
    if (timer) clearTimeout(timer);
    timer = null;
  }

  return { connect, close };
}
