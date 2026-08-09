import { describe, expect, it } from "vitest";
import { mergeStageNotes } from "./merge-notes";
import { initialStages } from "./reducer";
import type { StageExecution } from "@/lib/contracts/run";

describe("mergeStageNotes", () => {
  it("attaches the static note for each stage that has one", () => {
    const live = initialStages();
    const notesSource: StageExecution[] = [
      {
        stage: "CLS",
        state: "done",
        progressDone: 1,
        progressTotal: 1,
        durationMs: 400,
        costUsd: 0.002,
        note: "Classified: Ball Valve (Bronze/Brass) 0.97 rule+llm",
      },
    ];
    const merged = mergeStageNotes(live, notesSource);
    expect(merged.CLS.note).toBe("Classified: Ball Valve (Bronze/Brass) 0.97 rule+llm");
    expect(merged.SCH.note).toBeNull();
  });

  it("preserves the live (stream-derived) state/progress, not the static source's", () => {
    const live = initialStages();
    live.CLS = { ...live.CLS, state: "running", progressDone: 1, progressTotal: 1 };
    const notesSource: StageExecution[] = [
      {
        stage: "CLS",
        state: "done",
        progressDone: 1,
        progressTotal: 1,
        durationMs: 400,
        costUsd: 0.002,
        note: "static narration",
      },
    ];
    const merged = mergeStageNotes(live, notesSource);
    expect(merged.CLS.state).toBe("running"); // live state wins, not the static source's
    expect(merged.CLS.note).toBe("static narration");
  });

  it("returns null notes for every stage when no source is given", () => {
    const merged = mergeStageNotes(initialStages(), undefined);
    for (const code of Object.keys(merged) as (keyof typeof merged)[]) {
      expect(merged[code].note).toBeNull();
    }
  });

  it("returns an entry for all nine stages regardless of the notes source", () => {
    const merged = mergeStageNotes(initialStages(), []);
    expect(Object.keys(merged)).toHaveLength(9);
  });
});
