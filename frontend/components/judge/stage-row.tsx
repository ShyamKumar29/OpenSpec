import { CheckIcon, CircleIcon, LoaderCircleIcon, MinusIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCostUsd, formatDurationMs } from "@/lib/format/run";
import { STAGE_COPY } from "@/lib/run-events/stage-copy";
import type { StageDisplay } from "@/lib/run-events/merge-notes";

const STATE_COPY: Record<StageDisplay["state"], string> = {
  pending: "Pending",
  running: "Running",
  done: "Done",
  error: "Error",
  skipped: "Skipped",
};

function StateIcon({ state }: { state: StageDisplay["state"] }) {
  const cls = "size-4 shrink-0";
  switch (state) {
    case "done":
      return <CheckIcon className={cn(cls, "text-status-accepted")} aria-hidden="true" />;
    case "running":
      return (
        <LoaderCircleIcon
          className={cn(cls, "text-status-needs-review animate-spin motion-reduce:animate-none")}
          aria-hidden="true"
        />
      );
    case "error":
      return <XIcon className={cn(cls, "text-status-rejected")} aria-hidden="true" />;
    case "skipped":
      return <MinusIcon className={cn(cls, "text-muted-foreground")} aria-hidden="true" />;
    case "pending":
    default:
      return <CircleIcon className={cn(cls, "text-muted-foreground/50")} aria-hidden="true" />;
  }
}

/** One row of the pipeline timeline (docs/06-frontend.md §3.4). State is always icon +
 *  text together (`aria-label` carries "Done"/"Running"/… for screen readers; the icon
 *  alone is `aria-hidden`) — the same never-colour-alone discipline NFR-ACC-3 applies to
 *  confidence extends here to stage state. Multi-item stages (EXT/VER/VAL/NRM/CNF) get a
 *  live progress bar; single-unit stages (CLS/SCH/DOC/PRS) don't pretend to have one. */
export function StageRow({ stage }: { stage: StageDisplay }) {
  const copy = STAGE_COPY[stage.stage];
  const hasProgress = stage.progressTotal > 1;
  const percent = hasProgress ? Math.round((stage.progressDone / stage.progressTotal) * 100) : 0;

  return (
    <li
      data-testid="stage-row"
      data-stage={stage.stage}
      data-state={stage.state}
      className={cn(
        "flex flex-col gap-1 rounded-md px-2 py-1.5",
        stage.state === "running" && "bg-status-needs-review-bg/40",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="sr-only">{STATE_COPY[stage.state]}</span>
        <StateIcon state={stage.state} />
        <span className="metric text-muted-foreground w-8 shrink-0 text-xs font-semibold tracking-wide">
          {stage.stage}
        </span>
        <span className="text-foreground w-24 shrink-0 truncate text-sm font-medium sm:w-28">
          {copy.label}
        </span>
        <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
          {stage.note ?? (stage.state === "pending" ? copy.description : null)}
        </span>
        <span className="metric text-muted-foreground shrink-0 text-xs">
          {formatDurationMs(stage.durationMs)}
        </span>
        <span className="metric text-muted-foreground w-16 shrink-0 text-right text-xs">
          {formatCostUsd(stage.costUsd)}
        </span>
      </div>

      {hasProgress && stage.state !== "pending" ? (
        <div className="flex items-center gap-2 pl-[4.75rem]">
          <div
            role="progressbar"
            aria-valuenow={stage.progressDone}
            aria-valuemin={0}
            aria-valuemax={stage.progressTotal}
            aria-label={`${copy.label} progress`}
            className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full"
          >
            <div
              className={cn(
                "bg-status-needs-review h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none",
                stage.state === "done" && "bg-status-accepted",
                stage.state === "error" && "bg-status-rejected",
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="metric text-muted-foreground w-14 shrink-0 text-right text-xs">
            {stage.progressDone}/{stage.progressTotal}
          </span>
        </div>
      ) : null}
    </li>
  );
}
