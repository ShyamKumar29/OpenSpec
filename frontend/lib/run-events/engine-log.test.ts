import { describe, expect, it } from "vitest";
import {
  engineLogHeaderLines,
  engineLogSnapshot,
  engineLogStageLines,
  engineLogTerminalLines,
  selectUnseenLines,
} from "./engine-log";
import { initialStages } from "./reducer";
import type { StageCode, StageExecution } from "@/lib/contracts/run";

function execution(stage: StageCode, overrides: Partial<StageExecution> = {}): StageExecution {
  return {
    stage,
    state: "pending",
    progressDone: 0,
    progressTotal: 0,
    durationMs: null,
    costUsd: null,
    note: null,
    ...overrides,
  };
}

const CTX = { runId: "judge_run_success", mpn: "ABC-123", description: "1/2 BRS BALL VLV 600WOG" };

describe("engineLogHeaderLines", () => {
  it("echoes the submitted input back verbatim and omits what was not supplied", () => {
    const lines = engineLogHeaderLines(CTX);
    expect(lines.map((l) => l.text)).toEqual([
      "judge_run_success",
      "ABC-123",
      "1/2 BRS BALL VLV 600WOG",
    ]);
    expect(lines.some((l) => l.label === "DOC")).toBe(false);
  });

  it("does not interpret hostile free text — it is carried as literal line content (INV-7)", () => {
    const hostile = '<script>alert(1)</script> "; DROP TABLE records; --';
    const lines = engineLogHeaderLines({ runId: "r1", mpn: hostile });
    expect(lines.find((l) => l.label === "MPN")?.text).toBe(hostile);
  });
});

describe("engineLogStageLines", () => {
  it("says nothing at all about a stage that has not started", () => {
    expect(engineLogStageLines(execution("CLS"))).toEqual([]);
  });

  it("announces the operation when a stage starts, using the stage's own vocabulary", () => {
    const lines = engineLogStageLines(execution("CLS", { state: "running" }));
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("CLASSIFYING · Resolve the taxonomy class");
  });

  it("narrates per-attribute progress only for multi-unit stages that are still running", () => {
    const running = engineLogStageLines(
      execution("EXT", { state: "running", progressDone: 17, progressTotal: 22 }),
    );
    expect(running.map((l) => l.text)).toContain("EXTRACTING · 17/22");

    const singleUnit = engineLogStageLines(
      execution("CLS", { state: "running", progressDone: 1, progressTotal: 1 }),
    );
    expect(singleUnit.map((l) => l.text)).not.toContain("CLASSIFYING · 1/1");
  });

  it("reports duration, counts, and non-zero cost when a stage completes", () => {
    const lines = engineLogStageLines(
      execution("EXT", {
        state: "done",
        progressDone: 22,
        progressTotal: 22,
        durationMs: 6200,
        costUsd: 0.038,
      }),
    );
    expect(lines.map((l) => l.text)).toContain("DONE · 22/22 · 6.2s · $0.038");
  });

  it("omits a zero cost rather than padding every deterministic stage with $0.000", () => {
    const lines = engineLogStageLines(
      execution("NRM", {
        state: "done",
        progressDone: 1,
        progressTotal: 1,
        durationMs: 60,
        costUsd: 0,
      }),
    );
    expect(lines.map((l) => l.text)).toContain("DONE · 60ms");
  });

  it("emits the persisted narration note only once its own stage is done", () => {
    const note = "Bound: apollo-70-100-series.pdf, table 1 row 14, 0.98";
    expect(
      engineLogStageLines(execution("DOC", { state: "running" }), note).map((l) => l.text),
    ).not.toContain(note);
    expect(
      engineLogStageLines(execution("DOC", { state: "done", durationMs: 1100 }), note).map(
        (l) => l.text,
      ),
    ).toContain(note);
  });

  it("states a skip and its reason, and never claims the stage started", () => {
    const lines = engineLogStageLines(
      execution("PRS", { state: "skipped" }),
      "No document to parse",
    );
    expect(lines.map((l) => l.text)).toEqual(["SKIPPED · No document to parse"]);
  });

  it("carries an error through with the stage's own failure note", () => {
    const lines = engineLogStageLines(
      execution("PRS", { state: "error" }),
      "SYSTEM_ERROR: parser worker crashed mid-batch",
    );
    expect(lines.at(-1)).toMatchObject({
      tone: "error",
      text: "ERROR · SYSTEM_ERROR: parser worker crashed mid-batch",
    });
  });
});

describe("engineLogTerminalLines", () => {
  it("states the settled outcome for each terminal phase, and nothing while running", () => {
    const totals = { liveExtracted: 16, liveUnknown: 6, liveRejected: 0 };
    expect(engineLogTerminalLines("completed", totals, 0.055)[0].text).toBe(
      "COMPLETE · 16 extracted · 6 unknown · 0 rejected · $0.055",
    );
    expect(engineLogTerminalLines("cancelled", totals, 0.01)[0].text).toMatch(/CANCELLED/);
    expect(engineLogTerminalLines("timed_out", totals, 0.01)[0].text).toMatch(/TIMED OUT/);
    expect(engineLogTerminalLines("failed", totals, 0.01)[0].text).toMatch(/FAILED/);
    expect(engineLogTerminalLines("running", totals, 0.01)).toEqual([]);
  });
});

describe("engineLogSnapshot", () => {
  const totals = { liveExtracted: 0, liveUnknown: 0, liveRejected: 0 };

  it("narrates only the stages the run has actually reached, in pipeline order", () => {
    const stages = initialStages();
    stages.CLS = execution("CLS", { state: "done", durationMs: 420, costUsd: 0.002 });
    stages.SCH = execution("SCH", { state: "running" });

    const lines = engineLogSnapshot({
      ctx: CTX,
      phase: "running",
      stages,
      notes: [execution("CLS", { note: "Classified: Ball Valve (Bronze/Brass) 0.97 rule+llm" })],
      totals,
      costSoFar: 0.002,
    });

    const labels = lines.map((l) => l.label);
    expect(labels.indexOf("CLS")).toBeLessThan(labels.indexOf("SCH"));
    // Nothing downstream of the running stage has said anything.
    expect(labels).not.toContain("DOC");
    expect(lines.map((l) => l.text)).toContain(
      "Classified: Ball Valve (Bronze/Brass) 0.97 rule+llm",
    );
  });

  it("withholds a downstream stage's note until that stage itself completes", () => {
    const stages = initialStages();
    stages.CLS = execution("CLS", { state: "running" });
    const lines = engineLogSnapshot({
      ctx: CTX,
      phase: "running",
      stages,
      // The whole scripted run's notes are in hand from the first fetch — the gate is the
      // live stage state, not availability.
      notes: [execution("EXT", { note: "Seat Material candidate span from row 15" })],
      totals,
      costSoFar: 0,
    });
    expect(lines.map((l) => l.text)).not.toContain("Seat Material candidate span from row 15");
  });

  it("appends the terminal frame only once the run has settled", () => {
    const stages = initialStages();
    const running = engineLogSnapshot({ ctx: CTX, phase: "running", stages, totals, costSoFar: 0 });
    expect(running.some((l) => l.key.startsWith("run:completed"))).toBe(false);

    const done = engineLogSnapshot({ ctx: CTX, phase: "completed", stages, totals, costSoFar: 0 });
    expect(done.some((l) => l.key === "run:completed")).toBe(true);
  });
});

describe("selectUnseenLines", () => {
  it("returns only lines whose keys have not been transcribed, and never mutates the set", () => {
    const seen = new Set(["run:open"]);
    const fresh = selectUnseenLines(engineLogHeaderLines(CTX), seen);
    expect(fresh.map((l) => l.key)).toEqual(["run:mpn", "run:desc"]);
    expect(seen.size).toBe(1);
  });

  it("is idempotent for a repeated snapshot — a re-render cannot duplicate a line", () => {
    const seen = new Set<string>();
    const snapshot = engineLogHeaderLines(CTX);
    for (const line of selectUnseenLines(snapshot, seen)) seen.add(line.key);
    expect(selectUnseenLines(snapshot, seen)).toEqual([]);
  });
});
