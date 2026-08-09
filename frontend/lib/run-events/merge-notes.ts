/**
 * The SSE `stage` event shape (docs/api.md §Runs & progress) carries no narration text —
 * only stage/state/progress/duration/cost. The narration notes ("Bound: apollo-70-100-
 * series.pdf, table 1 row 14") are static per the scripted run and come from the one-time
 * `GET /runs/{id}` (or `/judge/runs/{id}`) fetch, which does carry `note` per stage (
 * `lib/contracts/run.ts`'s `StageExecution`). This merges that static narration onto the
 * live, stream-derived per-stage state for display, without smuggling a `note` field into
 * the live-stream reducer itself.
 */
import type { StageCode, StageExecution } from "@/lib/contracts/run";

export interface StageDisplay extends StageExecution {
  note: string | null;
}

export function mergeStageNotes(
  liveStages: Record<StageCode, StageExecution>,
  notesSource: StageExecution[] | null | undefined,
): Record<StageCode, StageDisplay> {
  const notesByStage = new Map((notesSource ?? []).map((s) => [s.stage, s.note]));
  const merged = {} as Record<StageCode, StageDisplay>;
  for (const [code, execution] of Object.entries(liveStages) as [StageCode, StageExecution][]) {
    merged[code] = { ...execution, note: notesByStage.get(code) ?? null };
  }
  return merged;
}
