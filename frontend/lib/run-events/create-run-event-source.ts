"use client";

/**
 * The factory behind the `RunEventSource` port — the one place a consumer's choice of
 * transport is made. Defaults to SSE (what a real backend will serve); falls back to
 * polling the same resource (docs/api.md risk M3) if `EventSource` throws on construction
 * or the environment doesn't have it at all (e.g. an old embedded browser at a kiosk).
 * `mode` can be forced for tests or for a future settings toggle — never for normal use.
 */
import { createSseRunEventSource, sseSupported } from "./sse-run-event-source";
import { createPollingRunEventSource } from "./polling-run-event-source";
import type { RunEventSource, RunEventSourceHandlers, RunEventSourceMode } from "./types";

export function createRunEventSource(
  runId: string,
  handlers: RunEventSourceHandlers,
  options: { mode?: RunEventSourceMode } = {},
): RunEventSource {
  const mode = options.mode ?? (sseSupported() ? "sse" : "poll");

  if (mode === "poll") {
    return createPollingRunEventSource(runId, handlers);
  }

  try {
    return createSseRunEventSource(runId, handlers);
  } catch {
    return createPollingRunEventSource(runId, handlers);
  }
}
