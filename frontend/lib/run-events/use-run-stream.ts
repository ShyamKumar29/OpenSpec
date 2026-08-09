"use client";

/**
 * The one hook every run-watching surface uses — Judge Mode and `/runs/:id` both call
 * this instead of touching `RunEventSource` or the reducer directly (docs/14-frontend-
 * implementation-plan.md §6 F4: "Reused by `/runs/:id` and Re-enrich").
 *
 * Owns: opening/closing the event source for the lifetime of `runId`, the hard timeout
 * with graceful partial results (FR-JDG-4), and cancellation. Does NOT own fetching the
 * run's target totals or the authoritative terminal status — those come from `GET
 * /runs/{id}` via TanStack Query in the calling component, which calls `finalize()` once
 * it has them. That split keeps this hook free of caching/retry concerns that TanStack
 * Query already owns.
 */
import { useCallback, useEffect, useReducer, useRef } from "react";
import { createRunEventSource } from "./create-run-event-source";
import {
  initialRunStreamState,
  runStreamReducer,
  type RunPhase,
  type RunStreamState,
  type RunTargetTotals,
} from "./reducer";
import type { RunEventSource, RunEventSourceMode } from "./types";

/** Judge Mode's runs are scripted to total well under 10s (docs/14-frontend-
 *  implementation-plan.md §4.3 caps each stage at 2s); this is generous headroom above
 *  that so it never fires in the demo itself, while still being short enough to exercise
 *  in a test with fake timers (FR-JDG-4: "hard timeout with graceful partial results"). */
export const RUN_STREAM_TIMEOUT_MS = 30_000;

export interface UseRunStreamOptions {
  timeoutMs?: number;
  /** Forces the transport for tests; production code never sets this. */
  mode?: RunEventSourceMode;
  /** Included in the connect effect's dependency list alongside `runId`. A scripted demo
   *  scenario reuses the same `run_id` on every "Run again" click (docs/14-frontend-
   *  implementation-plan.md §6 F4's re-run behaviour) — bumping this forces a fresh
   *  connection (and a full narration replay) even though `runId` itself didn't change. */
  resetKey?: string | number;
}

export interface UseRunStreamResult {
  state: RunStreamState;
  /** Call once the caller has fetched the run's authoritative terminal status/totals
   *  (typically right after the stream's "done" event, or immediately if the run was
   *  already finished when opened). No-op if the run already reached a terminal phase. */
  finalize: (
    phase: Extract<RunPhase, "completed" | "failed" | "cancelled">,
    totals?: RunTargetTotals,
  ) => void;
  /** Seeds the live-counter derivation with the run's known final totals. Safe to call
   *  before or after the stream starts producing events. */
  setTarget: (totals: RunTargetTotals) => void;
  /** Closes the stream and marks the run cancelled — pair with `POST /runs/{id}/cancel`
   *  (the caller's responsibility) to persist it server-side. */
  cancel: () => void;
}

export function useRunStream(
  runId: string | null,
  options: UseRunStreamOptions = {},
): UseRunStreamResult {
  const [state, dispatch] = useReducer(runStreamReducer, undefined, () => initialRunStreamState());
  const sourceRef = useRef<RunEventSource | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutMs = options.timeoutMs ?? RUN_STREAM_TIMEOUT_MS;

  useEffect(() => {
    dispatch({ type: "reset" });
    if (!runId) return;

    const source = createRunEventSource(
      runId,
      {
        onStage: (event) => dispatch({ type: "stage", event }),
        onDone: () => dispatch({ type: "stream-done" }),
        onError: (err) => dispatch({ type: "transport-error", message: err.message }),
      },
      { mode: options.mode },
    );
    sourceRef.current = source;
    source.connect();

    timeoutRef.current = setTimeout(() => {
      source.close();
      dispatch({ type: "timeout" });
    }, timeoutMs);

    return () => {
      source.close();
      sourceRef.current = null;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    };
  }, [runId, timeoutMs, options.mode, options.resetKey]);

  const finalize = useCallback(
    (phase: Extract<RunPhase, "completed" | "failed" | "cancelled">, totals?: RunTargetTotals) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      dispatch({ type: "finalize", phase, totals });
    },
    [],
  );

  const setTarget = useCallback((totals: RunTargetTotals) => {
    dispatch({ type: "target", target: totals });
  }, []);

  const cancel = useCallback(() => {
    sourceRef.current?.close();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    dispatch({ type: "cancelled" });
  }, []);

  return { state, finalize, setTarget, cancel };
}
