import { describe, expect, it } from "vitest";
import { mergeAuthoritativeStages } from "./merge-authoritative-stages";
import { initialStages } from "./reducer";
import type { StageCode, StageExecution } from "@/lib/contracts/run";

function exec(stage: StageCode, state: StageExecution["state"], done = 0): StageExecution {
  return {
    stage,
    state,
    progressDone: done,
    progressTotal: done,
    durationMs: null,
    costUsd: null,
    note: null,
  };
}

describe("mergeAuthoritativeStages", () => {
  it("shows persisted progress immediately, before the stream has narrated anything", () => {
    const merged = mergeAuthoritativeStages(initialStages(), [
      exec("CLS", "done", 60),
      exec("SCH", "done", 60),
      exec("EXT", "running", 22),
    ]);
    expect(merged.CLS.state).toBe("done");
    expect(merged.EXT.state).toBe("running");
    expect(merged.EXT.progressDone).toBe(22);
    // Stages the run itself has not reached stay pending — nothing is invented.
    expect(merged.CNF.state).toBe("pending");
  });

  it("lets the live stream take over once it has moved past the persisted snapshot", () => {
    const streamed = { ...initialStages(), EXT: exec("EXT", "done", 60) };
    const merged = mergeAuthoritativeStages(streamed, [exec("EXT", "running", 22)]);
    expect(merged.EXT.state).toBe("done");
    expect(merged.EXT.progressDone).toBe(60);
  });

  it("never lets a stale snapshot mask a failure the stream already reported", () => {
    const streamed = { ...initialStages(), VER: exec("VER", "error") };
    const merged = mergeAuthoritativeStages(streamed, [exec("VER", "running", 3)]);
    expect(merged.VER.state).toBe("error");
  });

  it("passes the streamed state straight through when the run detail has not loaded yet", () => {
    const streamed = initialStages();
    expect(mergeAuthoritativeStages(streamed, undefined)).toBe(streamed);
    expect(mergeAuthoritativeStages(streamed, [])).toBe(streamed);
  });

  it("keeps a stage the persisted snapshot does not mention", () => {
    const streamed = { ...initialStages(), NRM: exec("NRM", "running", 1) };
    const merged = mergeAuthoritativeStages(streamed, [exec("CLS", "done", 60)]);
    expect(merged.NRM.state).toBe("running");
  });
});
