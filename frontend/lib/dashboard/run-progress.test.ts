import { describe, expect, it } from "vitest";
import { runProgress } from "./run-progress";
import { STAGE_CODES, type Run, type StageCode, type StageState } from "@/lib/contracts/run";

function run(
  states: Partial<Record<StageCode, StageState>>,
  progress: Partial<Record<StageCode, [number, number]>> = {},
): Run {
  return {
    id: "run_test",
    kind: "batch",
    status: "running",
    recordId: null,
    mpn: "APOLLO-70-100",
    stages: STAGE_CODES.map((code) => ({
      stage: code,
      state: states[code] ?? "pending",
      progressDone: progress[code]?.[0] ?? 0,
      progressTotal: progress[code]?.[1] ?? 0,
      durationMs: null,
      costUsd: null,
      note: null,
    })),
    liveExtracted: 0,
    liveUnknown: 0,
    liveRejected: 0,
    costUsd: 0,
    tokensIn: 0,
    tokensOut: 0,
    startedAt: "2026-01-01T00:00:00Z",
    finishedAt: null,
  } as Run;
}

describe("runProgress", () => {
  it("reports an idle engine rather than inventing progress when nothing is running", () => {
    expect(runProgress(null)).toEqual({
      overall: 0,
      doneCount: 0,
      totalStages: 9,
      currentStage: null,
    });
    expect(runProgress(undefined).overall).toBe(0);
  });

  it("counts finished stages and names the one in flight", () => {
    const p = runProgress(
      run({ CLS: "done", SCH: "done", DOC: "done", PRS: "done", EXT: "running" }),
    );
    expect(p.doneCount).toBe(4);
    expect(p.currentStage).toBe("EXT");
    // Four of nine stages done, and nothing counted for the running one yet.
    expect(p.overall).toBe(44);
  });

  it("adds however far into the running stage the run has actually got", () => {
    const p = runProgress(
      run({ CLS: "done", SCH: "done", DOC: "done", PRS: "done", EXT: "running" }, { EXT: [1, 2] }),
    );
    // 4.5 of 9.
    expect(p.overall).toBe(50);
  });

  it("does not divide by a zero stage total", () => {
    const p = runProgress(run({ CLS: "running" }, { CLS: [0, 0] }));
    expect(p.overall).toBe(0);
    expect(Number.isNaN(p.overall)).toBe(false);
  });

  it("reaches 100% only when every stage is genuinely done", () => {
    const all = Object.fromEntries(STAGE_CODES.map((c) => [c, "done" as StageState]));
    expect(runProgress(run(all)).overall).toBe(100);
    expect(runProgress(run(all)).currentStage).toBeNull();
  });

  it("ignores skipped and errored stages when counting completion — neither is a finished stage", () => {
    const p = runProgress(run({ CLS: "done", SCH: "skipped", DOC: "error" }));
    expect(p.doneCount).toBe(1);
    expect(p.currentStage).toBeNull();
  });
});
