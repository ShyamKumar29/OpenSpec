import { Check, ChevronRight, LoaderCircle, Minus, X } from "lucide-react";
import { STAGE_CODES, type StageCode, type StageExecution } from "@/lib/contracts/run";
import { STAGE_COPY } from "@/lib/run-events/stage-copy";
import { cn } from "@/lib/utils";

const STATE_COPY: Record<StageExecution["state"], string> = {
  pending: "Pending",
  running: "Running",
  done: "Done",
  error: "Error",
  skipped: "Skipped",
};

/**
 * The horizontal pipeline stepper across the top of the Stitch Judge Mode screen
 * ("⊘ Import › ⊘ Classify › ▸ Extract Attributes › ⧗ Verify") — chevron-separated chips,
 * the running stage inverted to the solid primary fill with a pulsing frame, everything
 * behind it dimmed to "done", everything ahead of it dimmed to "pending".
 *
 * Companion to `StageTimeline`, not a replacement: the stepper answers "where is the run
 * right now" at a glance across the full width, the timeline answers "what did each stage
 * actually do and what did it cost". Both read the same nine `STAGE_CODES` in the same
 * fixed order from the same reducer state, so they can never disagree — the stepper simply
 * drops the notes, durations, and costs the timeline exists to show.
 *
 * State is icon + colour + an `sr-only` word, never colour alone (NFR-ACC-3), and all
 * motion is state-driven: `frozen` (set once the run reaches a terminal phase) stops the
 * spinner and the frame pulse, so a cancelled run does not go on looking busy.
 */
export function StageStepper({
  stages,
  frozen = false,
}: {
  stages: Record<StageCode, StageExecution>;
  /** True once the run has settled — completed, failed, cancelled, or timed out. */
  frozen?: boolean;
}) {
  return (
    <ol
      aria-label="Pipeline progress"
      className="border-border bg-card flex flex-wrap items-stretch rounded-sm border"
    >
      {STAGE_CODES.map((code, i) => {
        const stage = stages[code];
        const copy = STAGE_COPY[code];
        const active = stage.state === "running" && !frozen;
        return (
          <li
            key={code}
            data-testid="stage-step"
            data-stage={code}
            data-state={stage.state}
            className={cn(
              // `basis-28` rather than `min-w-0`: nine chips sharing one row compress to
              // illegibility on a phone, so below the width that fits them all the row
              // wraps into legible rows instead of shrinking (or scrolling sideways).
              "relative flex min-w-0 flex-1 basis-28 items-center gap-1.5 px-2 py-2",
              i > 0 && "border-border border-l",
              active && "bg-primary text-primary-foreground os-engine-frame",
              !active && stage.state === "running" && "bg-muted",
              !active && stage.state === "pending" && "text-muted-foreground",
              !active && stage.state === "done" && "text-foreground",
              !active && stage.state === "skipped" && "text-muted-foreground",
            )}
          >
            <span className="sr-only">{STATE_COPY[stage.state]}</span>
            <StepIcon state={stage.state} active={active} frozen={frozen} />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="metric text-[11px] font-semibold tracking-wide">{code}</span>
              <span className="truncate text-[11px]">{copy.label}</span>
            </span>
            {/* The Stitch chevron between chips. Decorative — the list order already
                carries the sequence — so it is hidden from assistive tech and dropped on
                the last chip. */}
            {i < STAGE_CODES.length - 1 ? (
              <ChevronRight
                aria-hidden="true"
                className={cn(
                  "ml-auto size-3 shrink-0",
                  active ? "text-primary-foreground/50" : "text-muted-foreground/40",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function StepIcon({
  state,
  active,
  frozen,
}: {
  state: StageExecution["state"];
  active: boolean;
  frozen: boolean;
}) {
  const cls = "size-3.5 shrink-0";
  switch (state) {
    case "done":
      return <Check className={cn(cls, active ? "" : "text-status-accepted")} aria-hidden="true" />;
    case "running":
      return (
        <LoaderCircle
          className={cn(cls, !frozen && "animate-spin motion-reduce:animate-none")}
          aria-hidden="true"
        />
      );
    case "error":
      return <X className={cn(cls, "text-status-rejected")} aria-hidden="true" />;
    case "skipped":
      return <Minus className={cn(cls, "text-muted-foreground")} aria-hidden="true" />;
    case "pending":
    default:
      return (
        <span
          aria-hidden="true"
          className="border-muted-foreground/50 size-2.5 shrink-0 rounded-full border"
        />
      );
  }
}
