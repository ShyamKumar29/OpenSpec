/**
 * The Judge Mode engine console's activity log — a *projection* of the authoritative run
 * state into narration lines (the Stitch Judge Mode screen's live data stream:
 * `SCANNING: …` / `FOUND_KEY: …` / `CONFIDENCE: …`).
 *
 * The critical property, and the reason this is a pure module with no React and no
 * timers: **every line is derived from something the run actually reported**. A line's
 * text can only be built out of a stage code, its live state, its live progress counts,
 * its duration, its cost, the stage's own persisted `note` from `GET /runs/{id}`, the
 * reducer's derived live counters, and what the user submitted. Nothing here invents a
 * pipeline fact, and no second event contract was added to the API to feed it — if the
 * stream never reports a stage, that stage never narrates.
 *
 * `engineLogSnapshot` answers "what has this run said *so far*, as of this state". It is
 * a snapshot rather than an accumulator because the reducer keeps only the current
 * per-stage execution; `useEngineLog` turns the successive snapshots into the append-only
 * transcript by keeping the lines whose `key` it has not seen before. Keys are therefore
 * deterministic functions of the state that produced them — replaying the same state
 * twice (React StrictMode's double-invoked effects, a re-render) can never duplicate a
 * line.
 */
import { STAGE_CODES, type StageCode, type StageExecution } from "@/lib/contracts/run";
import { formatCostUsd, formatDurationMs } from "@/lib/format/run";
import { STAGE_COPY } from "./stage-copy";
import { isTerminalPhase, type RunPhase, type RunTargetTotals } from "./reducer";

/** Drives the line's colour/emphasis in the console. Never the *only* signal — each line
 *  also carries its own label and words ("ERROR · …"), so nothing is colour-alone. */
export type EngineLogTone = "input" | "start" | "progress" | "done" | "note" | "result" | "error";

export interface EngineLogLine {
  /** Stable, deterministic identity — the dedupe key for the append-only transcript. */
  key: string;
  /** The left-hand gutter token: a stage code, or `RUN`/`MPN`/`INPUT`/`DOC`. */
  label: string;
  text: string;
  tone: EngineLogTone;
}

/** What the user submitted, echoed back verbatim. Free text is rendered as React text
 *  like everywhere else — never interpreted (INV-7). */
export interface EngineLogContext {
  runId: string;
  mpn?: string;
  description?: string;
  documentName?: string | null;
}

export interface EngineLogSnapshotInput {
  ctx: EngineLogContext;
  phase: RunPhase;
  stages: Record<StageCode, StageExecution>;
  /** The run's persisted stages from `GET /runs/{id}` — the only source of narration
   *  text (`note`), since the SSE `stage` frame carries none (see `merge-notes.ts`). A
   *  note is only ever emitted once its own stage has *live* reached that state, so the
   *  console cannot reveal an answer the pipeline has not reached yet. */
  notes?: StageExecution[] | null;
  totals: RunTargetTotals;
  costSoFar: number;
}

function counts(stage: StageExecution): string | null {
  return stage.progressTotal > 1 ? `${stage.progressDone}/${stage.progressTotal}` : null;
}

function join(parts: (string | null | undefined)[]): string {
  return parts.filter((p): p is string => Boolean(p)).join(" · ");
}

/** The opening frame: which run this is, and what went into it. */
export function engineLogHeaderLines(ctx: EngineLogContext): EngineLogLine[] {
  const lines: EngineLogLine[] = [
    { key: "run:open", label: "RUN", text: ctx.runId, tone: "input" },
  ];
  if (ctx.mpn) lines.push({ key: "run:mpn", label: "MPN", text: ctx.mpn, tone: "input" });
  if (ctx.description) {
    lines.push({ key: "run:desc", label: "INPUT", text: ctx.description, tone: "input" });
  }
  if (ctx.documentName) {
    lines.push({ key: "run:doc", label: "DOC", text: ctx.documentName, tone: "input" });
  }
  return lines;
}

/** One stage's narration as of its current execution state. */
export function engineLogStageLines(
  stage: StageExecution,
  note: string | null = null,
): EngineLogLine[] {
  const code = stage.stage;
  const copy = STAGE_COPY[code];
  const lines: EngineLogLine[] = [];

  if (stage.state === "pending") return lines;

  // A skipped stage never started, so it never announces a start — it only says it was
  // skipped, and why (the note is the pipeline's own reason).
  if (stage.state !== "skipped") {
    lines.push({
      key: `${code}:start`,
      label: code,
      text: `${copy.verb} · ${copy.description}`,
      tone: "start",
    });
  }

  if (stage.state === "running" && stage.progressTotal > 1 && stage.progressDone > 0) {
    lines.push({
      key: `${code}:p:${stage.progressDone}`,
      label: code,
      text: `${copy.verb} · ${stage.progressDone}/${stage.progressTotal}`,
      tone: "progress",
    });
  }

  if (stage.state === "done") {
    lines.push({
      key: `${code}:done`,
      label: code,
      text: join(["DONE", counts(stage), formatDurationMs(stage.durationMs), stageCost(stage)]),
      tone: "done",
    });
    if (note) lines.push({ key: `${code}:note`, label: code, text: note, tone: "note" });
  }

  if (stage.state === "skipped") {
    lines.push({
      key: `${code}:skipped`,
      label: code,
      text: join(["SKIPPED", note]),
      tone: "note",
    });
  }

  if (stage.state === "error") {
    lines.push({ key: `${code}:error`, label: code, text: join(["ERROR", note]), tone: "error" });
  }

  return lines;
}

/** `$0.000` is noise on the many zero-cost deterministic stages — omit it there rather
 *  than padding every line with a number that says nothing. */
function stageCost(stage: StageExecution): string | null {
  if (stage.costUsd === null || stage.costUsd === 0) return null;
  return formatCostUsd(stage.costUsd);
}

/** The closing frame. Mirrors `LiveResultPanel`'s headline, in the console's vocabulary. */
export function engineLogTerminalLines(
  phase: RunPhase,
  totals: RunTargetTotals,
  costSoFar: number,
): EngineLogLine[] {
  switch (phase) {
    case "completed":
      return [
        {
          key: "run:completed",
          label: "RUN",
          text: join([
            "COMPLETE",
            `${totals.liveExtracted} extracted`,
            `${totals.liveUnknown} unknown`,
            `${totals.liveRejected} rejected`,
            formatCostUsd(costSoFar),
          ]),
          tone: "result",
        },
      ];
    case "failed":
      return [
        { key: "run:failed", label: "RUN", text: "FAILED · narration stopped", tone: "error" },
      ];
    case "cancelled":
      return [
        {
          key: "run:cancelled",
          label: "RUN",
          text: "CANCELLED · stream closed between stages",
          tone: "note",
        },
      ];
    case "timed_out":
      return [
        {
          key: "run:timed_out",
          label: "RUN",
          text: "TIMED OUT · partial results retained",
          tone: "error",
        },
      ];
    default:
      return [];
  }
}

/**
 * Everything the run has said as of this state, in pipeline order: the input frame, then
 * each stage's narration, then the terminal frame once the run has actually settled.
 */
export function engineLogSnapshot(input: EngineLogSnapshotInput): EngineLogLine[] {
  const notesByStage = new Map((input.notes ?? []).map((s) => [s.stage, s.note]));
  const lines = engineLogHeaderLines(input.ctx);

  for (const code of STAGE_CODES) {
    lines.push(...engineLogStageLines(input.stages[code], notesByStage.get(code) ?? null));
  }

  if (isTerminalPhase(input.phase)) {
    lines.push(...engineLogTerminalLines(input.phase, input.totals, input.costSoFar));
  }

  return lines;
}

/**
 * The lines of a snapshot that have not been transcribed yet. Deliberately does *not*
 * mutate `seen` — recording them is the caller's separate step, which is what lets the
 * hook keep its React state updater pure (an updater that marked keys as seen would drop
 * lines under StrictMode's double invocation, since the second pass would find nothing
 * new and return the untouched transcript).
 */
export function selectUnseenLines(snapshot: EngineLogLine[], seen: Set<string>): EngineLogLine[] {
  return snapshot.filter((line) => !seen.has(line.key));
}
