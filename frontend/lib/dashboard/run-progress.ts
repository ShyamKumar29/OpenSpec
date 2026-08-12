/**
 * How far through the pipeline a run is.
 *
 * Two surfaces report this at once — the dashboard's active-run hotspot and the pipeline
 * band directly beneath it — and a dashboard whose own two readouts disagree about the
 * same run is exactly the kind of thing this product exists not to ship. So the arithmetic
 * lives here, once, and is pure: stage counts in, percentage out, no clock and no fetch.
 *
 * Progress is the run's own persisted stage counters (`GET /runs`), never a timer: a stage
 * that has stalled must read as stalled, not as creeping forward.
 */
import { STAGE_CODES, type Run, type StageCode, type StageExecution } from "@/lib/contracts/run";

export interface RunProgress {
  /** 0..100, whole percent: stages finished, plus how far into the running one we are. */
  overall: number;
  doneCount: number;
  totalStages: number;
  /** The stage currently `running`, or `null` when nothing is in flight. */
  currentStage: StageCode | null;
}

const IDLE: RunProgress = {
  overall: 0,
  doneCount: 0,
  totalStages: STAGE_CODES.length,
  currentStage: null,
};

export function runProgress(run: Run | null | undefined): RunProgress {
  if (!run) return IDLE;

  const byCode = new Map<StageCode, StageExecution>(run.stages.map((s) => [s.stage, s]));
  const doneCount = STAGE_CODES.filter((c) => byCode.get(c)?.state === "done").length;
  const currentStage = STAGE_CODES.find((c) => byCode.get(c)?.state === "running") ?? null;

  const current = currentStage ? byCode.get(currentStage) : undefined;
  const withinStage =
    current && current.progressTotal > 0 ? current.progressDone / current.progressTotal : 0;

  return {
    overall: Math.round(((doneCount + withinStage) / STAGE_CODES.length) * 100),
    doneCount,
    totalStages: STAGE_CODES.length,
    currentStage,
  };
}
