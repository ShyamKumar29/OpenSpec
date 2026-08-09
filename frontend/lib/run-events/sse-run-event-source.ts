"use client";

/**
 * The SSE transport. Talks to `GET /runs/{id}/events` (docs/api.md §Runs & progress) via
 * the browser's native `EventSource` — the same call a real backend deployment will
 * serve, since the mock implements this route as real SSE (D1). Swapping to a live
 * backend later is the base-URL change described in D4, not a new transport.
 */
import { apiUrl } from "@/lib/api/client";
import { stageEventWireSchema, adaptStageEvent } from "@/lib/contracts/run";
import type { RunEventSource, RunEventSourceHandlers } from "./types";

export function createSseRunEventSource(
  runId: string,
  handlers: RunEventSourceHandlers,
): RunEventSource {
  let source: EventSource | null = null;

  function connect() {
    if (source) return;
    source = new EventSource(apiUrl(`/runs/${runId}/events`));

    source.addEventListener("stage", (raw: MessageEvent<string>) => {
      try {
        const wire = stageEventWireSchema.parse(JSON.parse(raw.data));
        handlers.onStage(adaptStageEvent(wire));
      } catch (err) {
        handlers.onError(err instanceof Error ? err : new Error("Malformed stage event"));
      }
    });

    source.addEventListener("done", () => {
      handlers.onDone();
      close();
    });

    source.onerror = () => {
      // EventSource auto-retries by default; a scripted, finite mock stream should not
      // be retried after it has already closed itself via the "done" handler above — if
      // we get here the connection dropped mid-stream, which is a real transport error.
      handlers.onError(new Error("Run event stream connection lost"));
    };
  }

  function close() {
    source?.close();
    source = null;
  }

  return { connect, close };
}

/** `EventSource` is a browser-only global; this guards the SSR/build pass and lets the
 *  factory fall back to polling on any environment where it's genuinely unavailable. */
export function sseSupported(): boolean {
  return typeof EventSource !== "undefined";
}
