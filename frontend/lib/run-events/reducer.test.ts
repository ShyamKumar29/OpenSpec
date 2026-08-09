import { describe, expect, it } from "vitest";
import {
  initialRunStreamState,
  isTerminalPhase,
  runStreamReducer,
  type RunStreamState,
  type RunTargetTotals,
} from "./reducer";
import type { StageEvent } from "@/lib/contracts/run";

const TARGET: RunTargetTotals = { liveExtracted: 15, liveUnknown: 6, liveRejected: 1 };

function stageEvent(partial: Partial<StageEvent> & Pick<StageEvent, "stage">): StageEvent {
  return {
    recordId: "rec_canonical_abc123",
    state: "done",
    progress: { done: 1, total: 1 },
    durationMs: 100,
    costUsd: 0.001,
    ...partial,
  };
}

function withTarget(): RunStreamState {
  return runStreamReducer(initialRunStreamState(), { type: "target", target: TARGET });
}

describe("runStreamReducer", () => {
  it("starts idle with every stage pending and zeroed counters", () => {
    const state = initialRunStreamState();
    expect(state.phase).toBe("idle");
    expect(state.stages.CLS.state).toBe("pending");
    expect(state.stages.CNF.state).toBe("pending");
    expect(state.liveExtracted).toBe(0);
    expect(state.costSoFar).toBe(0);
  });

  it("moves to running and accumulates cost on the first stage event", () => {
    const state = runStreamReducer(withTarget(), {
      type: "stage",
      event: stageEvent({ stage: "CLS", costUsd: 0.002 }),
    });
    expect(state.phase).toBe("running");
    expect(state.stages.CLS.state).toBe("done");
    expect(state.costSoFar).toBe(0.002);
  });

  it("derives liveExtracted from EXT progress alone before VER/CNF land", () => {
    let state = withTarget();
    state = runStreamReducer(state, {
      type: "stage",
      event: stageEvent({ stage: "EXT", state: "running", progress: { done: 17, total: 22 } }),
    });
    expect(state.liveExtracted).toBe(17);
    expect(state.liveRejected).toBe(0);
    expect(state.liveUnknown).toBe(0);
  });

  it("reveals liveRejected only once VER reaches done, not before", () => {
    let state = withTarget();
    state = runStreamReducer(state, {
      type: "stage",
      event: stageEvent({ stage: "EXT", progress: { done: 22, total: 22 } }),
    });
    state = runStreamReducer(state, {
      type: "stage",
      event: stageEvent({ stage: "VER", state: "running", progress: { done: 10, total: 22 } }),
    });
    expect(state.liveRejected).toBe(0);
    expect(state.liveExtracted).toBe(22);

    state = runStreamReducer(state, {
      type: "stage",
      event: stageEvent({ stage: "VER", state: "done", progress: { done: 22, total: 22 } }),
    });
    expect(state.liveRejected).toBe(TARGET.liveRejected);
    // Extracted drops by exactly the revealed rejection — exact integer arithmetic, no drift.
    expect(state.liveExtracted).toBe(22 - TARGET.liveRejected);
  });

  it("reveals liveUnknown only once CNF reaches done, and settles extracted to the true partition", () => {
    let state = withTarget();
    state = runStreamReducer(state, {
      type: "stage",
      event: stageEvent({ stage: "EXT", progress: { done: 22, total: 22 } }),
    });
    state = runStreamReducer(state, {
      type: "stage",
      event: stageEvent({ stage: "VER", progress: { done: 22, total: 22 } }),
    });
    state = runStreamReducer(state, {
      type: "stage",
      event: stageEvent({ stage: "CNF", state: "running", progress: { done: 21, total: 22 } }),
    });
    expect(state.liveUnknown).toBe(0);

    state = runStreamReducer(state, {
      type: "stage",
      event: stageEvent({ stage: "CNF", progress: { done: 22, total: 22 } }),
    });
    expect(state.liveUnknown).toBe(TARGET.liveUnknown);
    expect(state.liveExtracted).toBe(22 - TARGET.liveRejected - TARGET.liveUnknown);
    expect(state.liveExtracted).toBe(TARGET.liveExtracted);
  });

  it("handles the abstain shape — EXT never runs, CNF alone reveals every attribute as Unknown", () => {
    const abstainTarget: RunTargetTotals = { liveExtracted: 0, liveUnknown: 17, liveRejected: 0 };
    let state = runStreamReducer(initialRunStreamState(), {
      type: "target",
      target: abstainTarget,
    });
    state = runStreamReducer(state, {
      type: "stage",
      event: stageEvent({ stage: "EXT", state: "skipped", progress: { done: 0, total: 0 } }),
    });
    state = runStreamReducer(state, {
      type: "stage",
      event: stageEvent({ stage: "CNF", state: "done", progress: { done: 0, total: 17 } }),
    });
    expect(state.liveUnknown).toBe(17);
    expect(state.liveExtracted).toBe(0);
    expect(state.liveRejected).toBe(0);
  });

  it("finalize snaps a completed run to its exact target totals", () => {
    let state = withTarget();
    state = runStreamReducer(state, {
      type: "finalize",
      phase: "completed",
      totals: TARGET,
    });
    expect(state.phase).toBe("completed");
    expect(state.liveExtracted).toBe(TARGET.liveExtracted);
    expect(state.liveUnknown).toBe(TARGET.liveUnknown);
    expect(state.liveRejected).toBe(TARGET.liveRejected);
  });

  it("ignores transport-sourced actions once a terminal phase is reached", () => {
    let state = runStreamReducer(withTarget(), { type: "finalize", phase: "completed" });
    const beforeStage = state;
    state = runStreamReducer(state, {
      type: "stage",
      event: stageEvent({ stage: "CLS", state: "error" }),
    });
    expect(state).toBe(beforeStage); // reference-equal: reducer returned the same object

    state = runStreamReducer(state, { type: "timeout" });
    expect(state.phase).toBe("completed");

    state = runStreamReducer(state, { type: "transport-error", message: "late error" });
    expect(state.phase).toBe("completed");
  });

  it("timeout marks the run timed_out and preserves whatever partial state it has", () => {
    let state = withTarget();
    state = runStreamReducer(state, {
      type: "stage",
      event: stageEvent({ stage: "CLS" }),
    });
    state = runStreamReducer(state, { type: "timeout" });
    expect(state.phase).toBe("timed_out");
    expect(state.stages.CLS.state).toBe("done"); // partial progress survives the timeout
  });

  it("cancel marks the run cancelled", () => {
    const state = runStreamReducer(withTarget(), { type: "cancelled" });
    expect(state.phase).toBe("cancelled");
  });

  it("transport-error marks the run failed and records the message", () => {
    const state = runStreamReducer(withTarget(), {
      type: "transport-error",
      message: "connection lost",
    });
    expect(state.phase).toBe("failed");
    expect(state.transportError).toBe("connection lost");
  });

  it("reset returns to idle, optionally with a fresh target", () => {
    let state = withTarget();
    state = runStreamReducer(state, {
      type: "stage",
      event: stageEvent({ stage: "CLS" }),
    });
    state = runStreamReducer(state, {
      type: "reset",
      target: { liveExtracted: 1, liveUnknown: 0, liveRejected: 0 },
    });
    expect(state.phase).toBe("idle");
    expect(state.stages.CLS.state).toBe("pending");
    expect(state.target.liveExtracted).toBe(1);
  });
});

describe("isTerminalPhase", () => {
  it("is true only for completed/failed/cancelled/timed_out", () => {
    expect(isTerminalPhase("idle")).toBe(false);
    expect(isTerminalPhase("running")).toBe(false);
    expect(isTerminalPhase("completed")).toBe(true);
    expect(isTerminalPhase("failed")).toBe(true);
    expect(isTerminalPhase("cancelled")).toBe(true);
    expect(isTerminalPhase("timed_out")).toBe(true);
  });
});
