/**
 * Pure reducer over a run's live stream state — no React, no timers, no I/O, so it is
 * unit-testable in isolation from `EventSource`/`fetch` (mirrors the domain-purity
 * discipline CLAUDE.md asks of `domain/nrm` and `domain/val`, applied to the one piece of
 * frontend state complex enough to deserve it).
 *
 * The "live" counters are *derived*, never duplicated input: `EXT`'s own progress *is*
 * the extracted count; `VER`/`CNF` reaching `done` is the exact moment rejection/unknown
 * become knowable, so those counters snap from 0 to their true value at that instant
 * rather than interpolating a fake curve. Every number is exact-integer arithmetic
 * (extracted = ext.done - rejected - unknown, clamped at 0) — no float drift, no
 * rounding, consistent with CLAUDE.md's aversion to approximated arithmetic. The "target"
 * totals (the run's true final `live_extracted`/`live_unknown`/`live_rejected`) come from
 * one `GET /runs/{id}` fetch made when the run starts — reading them progressively is a
 * presentation device for a scripted demo, not a claim that a real backend would expose
 * unfinished answers early.
 */
import {
  STAGE_CODES,
  type StageCode,
  type StageEvent,
  type StageExecution,
} from "@/lib/contracts/run";

export type RunPhase = "idle" | "running" | "completed" | "failed" | "cancelled" | "timed_out";

export interface RunTargetTotals {
  liveExtracted: number;
  liveUnknown: number;
  liveRejected: number;
}

export interface RunStreamState {
  phase: RunPhase;
  stages: Record<StageCode, StageExecution>;
  target: RunTargetTotals;
  liveExtracted: number;
  liveUnknown: number;
  liveRejected: number;
  costSoFar: number;
  transportError: string | null;
  /** True once the stream has delivered its "done" frame — narration finished, whether
   *  or not `finalize` has landed yet. Lives in reducer state (not a ref) so it can be
   *  read during render without violating React's "no ref access during render" rule. */
  streamDone: boolean;
}

export type RunStreamAction =
  | { type: "reset"; target?: RunTargetTotals }
  | { type: "target"; target: RunTargetTotals }
  | { type: "stage"; event: StageEvent }
  | { type: "stream-done" }
  | {
      type: "finalize";
      phase: Extract<RunPhase, "completed" | "failed" | "cancelled">;
      totals?: RunTargetTotals;
    }
  | { type: "transport-error"; message: string }
  | { type: "cancelled" }
  | { type: "timeout" };

function pendingStage(stage: StageCode): StageExecution {
  return {
    stage,
    state: "pending",
    progressDone: 0,
    progressTotal: 0,
    durationMs: null,
    costUsd: null,
    note: null,
  };
}

export function initialStages(): Record<StageCode, StageExecution> {
  const stages = {} as Record<StageCode, StageExecution>;
  for (const code of STAGE_CODES) stages[code] = pendingStage(code);
  return stages;
}

export const ZERO_TOTALS: RunTargetTotals = { liveExtracted: 0, liveUnknown: 0, liveRejected: 0 };

export function initialRunStreamState(target: RunTargetTotals = ZERO_TOTALS): RunStreamState {
  return {
    phase: "idle",
    stages: initialStages(),
    target,
    liveExtracted: 0,
    liveUnknown: 0,
    liveRejected: 0,
    costSoFar: 0,
    transportError: null,
    streamDone: false,
  };
}

/** Sum of every stage's own cost-so-far — each `stage` event carries that stage's
 *  cumulative cost at its current tick, so the total is a plain sum, not an estimate. */
function totalCost(stages: Record<StageCode, StageExecution>): number {
  let sum = 0;
  for (const code of STAGE_CODES) sum += stages[code].costUsd ?? 0;
  return Math.round(sum * 1000) / 1000;
}

/** VER reaching `done` is the exact point rejection becomes knowable; CNF reaching
 *  `done` is the exact point Unknown becomes knowable. Extracted is whatever `EXT` has
 *  produced so far, less whatever has since been claimed by rejection or Unknown —
 *  never negative, never re-estimated. */
function deriveLiveCounts(
  stages: Record<StageCode, StageExecution>,
  target: RunTargetTotals,
): { liveExtracted: number; liveUnknown: number; liveRejected: number } {
  const ext = stages.EXT;
  const ver = stages.VER;
  const cnf = stages.CNF;
  const liveRejected = ver.state === "done" ? target.liveRejected : 0;
  const liveUnknown = cnf.state === "done" ? target.liveUnknown : 0;
  const liveExtracted = Math.max(0, ext.progressDone - liveRejected - liveUnknown);
  return { liveExtracted, liveUnknown, liveRejected };
}

export function runStreamReducer(state: RunStreamState, action: RunStreamAction): RunStreamState {
  // Transport-sourced actions are ignored once the run has reached a terminal phase — a
  // stray late event (a trailing EventSource error after an already-processed "done", a
  // timeout firing just after completion) must never downgrade a settled result.
  const transportSourced =
    action.type === "stage" ||
    action.type === "stream-done" ||
    action.type === "transport-error" ||
    action.type === "cancelled" ||
    action.type === "timeout";
  if (transportSourced && isTerminalPhase(state.phase)) return state;

  switch (action.type) {
    case "reset":
      return initialRunStreamState(action.target ?? state.target);

    case "target":
      return { ...state, target: action.target };

    case "stage": {
      const stages = { ...state.stages, [action.event.stage]: stageFromEvent(action.event) };
      const counts = deriveLiveCounts(stages, state.target);
      return {
        ...state,
        phase: "running",
        stages,
        costSoFar: totalCost(stages),
        ...counts,
      };
    }

    case "stream-done":
      // The stream narrated its script; the *authoritative* terminal phase is set by
      // "finalize" once the caller refetches the run detail. Staying "running" here (not
      // guessing "completed") avoids a flash of a possibly-wrong status.
      return { ...state, streamDone: true };

    case "finalize": {
      const totals = action.totals ?? state.target;
      const counts =
        action.phase === "completed"
          ? {
              liveExtracted: totals.liveExtracted,
              liveUnknown: totals.liveUnknown,
              liveRejected: totals.liveRejected,
            }
          : deriveLiveCounts(state.stages, totals);
      return { ...state, phase: action.phase, target: totals, ...counts };
    }

    case "transport-error":
      return { ...state, phase: "failed", transportError: action.message };

    case "cancelled":
      return { ...state, phase: "cancelled" };

    case "timeout":
      return { ...state, phase: "timed_out" };

    default:
      return state;
  }
}

function stageFromEvent(event: StageEvent): StageExecution {
  return {
    stage: event.stage,
    state: event.state,
    progressDone: event.progress.done,
    progressTotal: event.progress.total,
    durationMs: event.durationMs,
    costUsd: event.costUsd,
    note: null,
  };
}

export const RUN_TERMINAL_PHASES: readonly RunPhase[] = [
  "completed",
  "failed",
  "cancelled",
  "timed_out",
];

export function isTerminalPhase(phase: RunPhase): boolean {
  return (RUN_TERMINAL_PHASES as readonly string[]).includes(phase);
}
