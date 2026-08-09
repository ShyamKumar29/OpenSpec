/**
 * `RunEventSource` — the port F4 is built around (docs/14-frontend-implementation-plan.md
 * §6 F4: "a `RunEventSource` port with a scripted mock implementation now and an SSE
 * implementation later"). In this codebase the mock server already speaks real SSE (D1:
 * "the mock layer implements api.md routes literally"), so the "SSE implementation" and
 * the "mock" are the same code path — swapping to a real backend later is a base-URL
 * change (D4), not a new implementation.
 *
 * Consumers (the `useRunStream` hook) depend only on this interface, never on
 * `EventSource` or `fetch` directly — that's what keeps the boundary clean for a future
 * backend swap and for `/runs/:id` / Re-enrich to reuse without duplicating transport code.
 */
import type { StageEvent } from "@/lib/contracts/run";

export interface RunEventSourceHandlers {
  onStage: (event: StageEvent) => void;
  /** The stream reached its end — the run finished narrating (not necessarily
   *  successfully; terminal status comes from the run detail fetch, not this signal). */
  onDone: () => void;
  /** Transport-level failure (connection lost, non-2xx, parse error). Distinct from a
   *  pipeline-level `error` stage, which arrives via `onStage` with `state: "error"`. */
  onError: (error: Error) => void;
}

export interface RunEventSource {
  /** Opens the connection and starts delivering events. Idempotent no-op if already open. */
  connect(): void;
  /** Closes the connection. Safe to call multiple times; safe to call before `connect`.
   *  This is the "cooperative cancel between stages" half of cancelling a run (docs/api.md
   *  §Runs & progress) — pair it with `POST /runs/{id}/cancel` to persist the cancellation
   *  server-side. */
  close(): void;
}

/** Which transport actually served the stream — surfaced for diagnostics/tests, not
 *  something a consumer branches on. */
export type RunEventSourceMode = "sse" | "poll";
