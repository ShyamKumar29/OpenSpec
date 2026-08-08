/**
 * Runs & progress, and Judge Mode (docs/api.md §Runs & progress, §Judge Mode).
 * `STAGE_CODES` is the pipeline stage sequence narrated in Judge Mode and `/runs/:id`
 * (docs/06-frontend.md §3.4): CLS · SCH · DOC · PRS · EXT · VER · VAL · NRM · CNF.
 */
import { z } from "zod";

export const STAGE_CODES = ["CLS", "SCH", "DOC", "PRS", "EXT", "VER", "VAL", "NRM", "CNF"] as const;
export type StageCode = (typeof STAGE_CODES)[number];

export const STAGE_STATES = ["pending", "running", "done", "error", "skipped"] as const;
export type StageState = (typeof STAGE_STATES)[number];

export const RUN_KINDS = ["batch", "single", "judge"] as const;
export type RunKind = (typeof RUN_KINDS)[number];

export const RUN_STATUSES = ["queued", "running", "completed", "failed", "cancelled"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

const stageExecutionWireSchema = z.object({
  stage: z.enum(STAGE_CODES),
  state: z.enum(STAGE_STATES),
  progress_done: z.number().int().nonnegative(),
  progress_total: z.number().int().nonnegative(),
  duration_ms: z.number().nonnegative().nullable(),
  cost_usd: z.number().nonnegative().nullable(),
  note: z.string().nullable(),
});
export type StageExecutionWire = z.infer<typeof stageExecutionWireSchema>;

export interface StageExecution {
  stage: StageCode;
  state: StageState;
  progressDone: number;
  progressTotal: number;
  durationMs: number | null;
  costUsd: number | null;
  note: string | null;
}

function adaptStageExecution(wire: StageExecutionWire): StageExecution {
  return {
    stage: wire.stage,
    state: wire.state,
    progressDone: wire.progress_done,
    progressTotal: wire.progress_total,
    durationMs: wire.duration_ms,
    costUsd: wire.cost_usd,
    note: wire.note,
  };
}

export const runWireSchema = z.object({
  id: z.string(),
  kind: z.enum(RUN_KINDS),
  status: z.enum(RUN_STATUSES),
  record_id: z.string().nullable(),
  mpn: z.string().nullable(),
  stages: z.array(stageExecutionWireSchema),
  live_extracted: z.number().int().nonnegative(),
  live_unknown: z.number().int().nonnegative(),
  live_rejected: z.number().int().nonnegative(),
  cost_usd: z.number().nonnegative(),
  tokens_in: z.number().int().nonnegative(),
  tokens_out: z.number().int().nonnegative(),
  started_at: z.string(),
  finished_at: z.string().nullable(),
});
export type RunWire = z.infer<typeof runWireSchema>;

export interface Run {
  id: string;
  kind: RunKind;
  status: RunStatus;
  recordId: string | null;
  mpn: string | null;
  stages: StageExecution[];
  liveExtracted: number;
  liveUnknown: number;
  liveRejected: number;
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
  startedAt: string;
  finishedAt: string | null;
}

export function adaptRun(wireInput: unknown): Run {
  const wire = runWireSchema.parse(wireInput);
  return {
    id: wire.id,
    kind: wire.kind,
    status: wire.status,
    recordId: wire.record_id,
    mpn: wire.mpn,
    stages: wire.stages.map(adaptStageExecution),
    liveExtracted: wire.live_extracted,
    liveUnknown: wire.live_unknown,
    liveRejected: wire.live_rejected,
    costUsd: wire.cost_usd,
    tokensIn: wire.tokens_in,
    tokensOut: wire.tokens_out,
    startedAt: wire.started_at,
    finishedAt: wire.finished_at,
  };
}

/** SSE `stage` event payload (docs/api.md §Runs & progress). */
export const stageEventWireSchema = z.object({
  record_id: z.string().nullable(),
  stage: z.enum(STAGE_CODES),
  state: z.enum(STAGE_STATES),
  progress: z.object({
    done: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
  duration_ms: z.number().nonnegative(),
  cost_usd: z.number().nonnegative(),
});
export type StageEventWire = z.infer<typeof stageEventWireSchema>;

export interface StageEvent {
  recordId: string | null;
  stage: StageCode;
  state: StageState;
  progress: { done: number; total: number };
  durationMs: number;
  costUsd: number;
}

export function adaptStageEvent(wireInput: unknown): StageEvent {
  const wire = stageEventWireSchema.parse(wireInput);
  return {
    recordId: wire.record_id,
    stage: wire.stage,
    state: wire.state,
    progress: wire.progress,
    durationMs: wire.duration_ms,
    costUsd: wire.cost_usd,
  };
}

export const JUDGE_SCENARIOS = ["success", "abstain", "rejected"] as const;
export type JudgeScenario = (typeof JUDGE_SCENARIOS)[number];
