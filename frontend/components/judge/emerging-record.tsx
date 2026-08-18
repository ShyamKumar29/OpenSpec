"use client";

/**
 * The "Emerging Record" pane of the Stitch Judge Mode screen — the right-hand column that
 * fills in as the pipeline reaches the stage that can answer each field.
 *
 * The honesty rule (INV-1, INV-4) is what makes this pane worth having: a field is only
 * ever populated from something the run has *already reported*. The narration text for
 * every stage is technically in hand from the moment the run detail is fetched, so this
 * component gates each row on that stage's own **live** state — a row cannot show its
 * answer before the stage that produced it has run. A row with no answer yet says
 * "Processing…", and a stage that was skipped says so and why. Nothing is guessed, and no
 * attribute value is displayed here at all: verified values are the completed run's
 * business, and they arrive through `LiveResultPanel`'s hand-off into the real
 * `AttributeRow`/Why-panel surfaces.
 */
import { cn } from "@/lib/utils";
import { STAGE_COPY } from "@/lib/run-events/stage-copy";
import type { StageCode, StageExecution } from "@/lib/contracts/run";

/** The four single-answer stages whose `note` reads as a record field. EXT/VER/VAL/NRM/CNF
 *  are per-attribute stages — their progress belongs on the pipeline ledger and the live
 *  counters, not as a one-line "value" here. */
const FIELD_STAGES: { stage: StageCode; label: string }[] = [
  { stage: "CLS", label: "Class" },
  { stage: "SCH", label: "Schema" },
  { stage: "DOC", label: "Document" },
  { stage: "PRS", label: "Parse" },
];

export interface EmergingRecordProps {
  /** Live per-stage state from the run stream — the gate on what may be shown. */
  stages: Record<StageCode, StageExecution>;
  /** The run's persisted stages (`GET /runs/{id}`), the only source of narration text. */
  notes?: StageExecution[] | null;
  mpn?: string;
  description?: string;
  documentName?: string | null;
}

export function EmergingRecord({
  stages,
  notes,
  mpn,
  description,
  documentName,
}: EmergingRecordProps) {
  const noteByStage = new Map((notes ?? []).map((s) => [s.stage, s.note]));
  const ext = stages.EXT;

  return (
    <dl data-testid="emerging-record" className="flex flex-col">
      {/* What the judge typed — known before the pipeline starts, so it is stated
          immediately rather than pretending to be discovered. */}
      {mpn ? <Row label="MPN" value={mpn} state="known" /> : null}
      {description ? <Row label="Input" value={description} state="known" /> : null}
      {documentName ? <Row label="Attached" value={documentName} state="known" /> : null}

      {FIELD_STAGES.map(({ stage, label }) => {
        const execution = stages[stage];
        const note = noteByStage.get(stage) ?? null;
        return (
          <Row
            key={stage}
            label={label}
            value={fieldValue(execution, note)}
            state={fieldState(execution)}
            busyLabel={STAGE_COPY[stage].verb}
          />
        );
      })}

      <Row
        label="Attributes"
        value={
          ext.progressTotal > 0
            ? `${ext.progressDone}/${ext.progressTotal} extracted`
            : ext.state === "skipped"
              ? "None — no document to extract from"
              : null
        }
        state={
          ext.state === "pending"
            ? "pending"
            : ext.state === "skipped"
              ? "skipped"
              : ext.state === "done"
                ? "known"
                : "running"
        }
        busyLabel={STAGE_COPY.EXT.verb}
      />
    </dl>
  );
}

type RowState = "known" | "pending" | "running" | "skipped" | "error";

function fieldState(execution: StageExecution): RowState {
  switch (execution.state) {
    case "done":
      return "known";
    case "running":
      return "running";
    case "skipped":
      return "skipped";
    case "error":
      return "error";
    default:
      return "pending";
  }
}

/** A stage that has not finished has no answer to give — the stage's *description* is
 *  what it is doing, never a stand-in for what it found. */
function fieldValue(execution: StageExecution, note: string | null): string | null {
  if (execution.state === "done" || execution.state === "skipped" || execution.state === "error") {
    return note ?? STAGE_COPY[execution.stage].description;
  }
  return null;
}

const STATE_COPY: Record<RowState, string> = {
  known: "Resolved",
  pending: "Queued",
  running: "Processing",
  skipped: "Skipped",
  error: "Failed",
};

function Row({
  label,
  value,
  state,
  busyLabel,
}: {
  label: string;
  value: string | null;
  state: RowState;
  /** What to show while this row has no answer yet — the stage's own operation token, so
   *  the placeholder says what is happening rather than implying a value is imminent. */
  busyLabel?: string;
}) {
  const resolved = state === "known" || state === "skipped" || state === "error";
  return (
    <div
      data-testid="emerging-record-row"
      data-state={state}
      className="hairline flex flex-col gap-0.5 border-b py-2 last:border-b-0"
    >
      <dt className="label-caps label-caps-sm text-muted-foreground flex items-center gap-1.5">
        {label}
        <span className="sr-only">— {STATE_COPY[state]}</span>
      </dt>
      <dd
        className={cn(
          "metric text-xs break-words",
          resolved ? "text-foreground" : "text-muted-foreground",
          state === "error" && "text-status-rejected",
        )}
      >
        {value ?? (
          <>
            {state === "running" ? `${busyLabel ?? "PROCESSING"}…` : "QUEUED"}
            <span aria-hidden="true" className="os-caret ml-0.5">
              ▍
            </span>
          </>
        )}
      </dd>
    </div>
  );
}
