import { CheckIcon, CircleIcon, LoaderCircleIcon, MinusIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGE_COPY } from "@/lib/run-events/stage-copy";
import type { StageCode, StageExecution } from "@/lib/contracts/run";

const STATE_LABEL: Record<StageExecution["state"], string> = {
  pending: "Pending",
  running: "Running",
  done: "Done",
  error: "Error",
  skipped: "Skipped",
};

/** Same icon+colour convention as `components/judge/stage-row.tsx`'s `StateIcon` —
 *  Judge Mode, `/runs/:id`, and the dashboard's pipeline visualization all narrate the
 *  same nine stages and must read as one system, not three different encodings of
 *  "running". */
function NodeIcon({ state }: { state: StageExecution["state"] }) {
  const cls = "size-3.5 shrink-0";
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

/** One stage node — the same nine `STAGE_CODES` as `StageTimeline`
 *  (`components/judge/stage-timeline.tsx`). State, never colour alone (NFR-ACC-3): icon +
 *  `sr-only` text + the surface tint together.
 *
 *  `layout="row"` is the Stitch "RUN / SYSTEM OVERVIEW" presentation — a dense vertical
 *  checklist with an inline progress bar on the stage that is currently running.
 *  `layout="tile"` is the original glanceable strip, still used where a horizontal row of
 *  stages reads better than a list. */
export function PipelineNode({
  code,
  stage,
  layout = "tile",
  dense = false,
}: {
  code: StageCode;
  stage: StageExecution;
  layout?: "tile" | "row";
  /** Tightens `layout="row"` for the command center's floating overview instrument,
   *  where nine stages have to fit inside roughly a third of the hero's height. */
  dense?: boolean;
}) {
  const copy = STAGE_COPY[code];
  const shared = {
    "data-testid": "pipeline-node",
    "data-stage": code,
    "data-state": stage.state,
    title: `${copy.label} — ${STATE_LABEL[stage.state]}`,
  };

  if (layout === "row") {
    const pct =
      stage.progressTotal > 0
        ? Math.round((stage.progressDone / stage.progressTotal) * 100)
        : stage.state === "done"
          ? 100
          : 0;
    return (
      <div
        {...shared}
        className={cn(
          "flex items-center gap-2 px-2 transition-colors duration-300",
          // The command center floats nine of these inside about half the height of a
          // 720px-tall hero, so `dense` is genuinely dense: no row padding at all, and
          // the type one step down. Nothing is dropped — every stage still shows its
          // code, its name, its state icon and its progress.
          dense ? "py-px" : "py-1.5",
          stage.state === "running" && "bg-status-needs-review-bg/50",
          stage.state === "error" && "bg-status-rejected-bg/50",
        )}
      >
        <span className="sr-only">{STATE_LABEL[stage.state]}</span>
        <NodeIcon state={stage.state} />
        {/* Code + name together — the same vocabulary the topbar strip, Judge Mode, and
            `/runs/:id` use, so a reader never has to translate between them. */}
        <span
          className={cn(
            "metric shrink-0 font-semibold",
            dense ? "text-[0.625rem]" : "text-[0.6875rem]",
            stage.state === "done" || stage.state === "running"
              ? "text-foreground"
              : "text-muted-foreground",
          )}
        >
          {code}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            dense ? "text-[0.625rem] leading-[1.5]" : "text-xs",
            stage.state === "done" || stage.state === "running"
              ? "text-foreground"
              : "text-muted-foreground",
            stage.state === "running" && "font-semibold",
          )}
        >
          {copy.label}
        </span>
        {stage.state === "running" ? (
          <span
            aria-hidden="true"
            className="bg-muted h-1 w-8 shrink-0 overflow-hidden rounded-full"
          >
            <span
              className="bg-status-needs-review block h-full transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </span>
        ) : (
          <span
            aria-hidden="true"
            className={cn(
              "metric shrink-0 text-[0.65rem]",
              stage.state === "done" ? "text-status-accepted" : "text-muted-foreground/60",
            )}
          >
            {stage.state === "done" ? "•" : "–"}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      {...shared}
      className={cn(
        "border-border bg-card flex min-w-[4.75rem] flex-1 flex-col items-center gap-1 rounded-sm border px-2 py-2 text-center transition-colors duration-300",
        stage.state === "running" && "border-status-needs-review/50 bg-status-needs-review-bg/40",
        stage.state === "done" && "border-status-accepted/30",
        stage.state === "error" && "border-status-rejected/50 bg-status-rejected-bg/40",
      )}
    >
      <span className="sr-only">{STATE_LABEL[stage.state]}</span>
      <NodeIcon state={stage.state} />
      <span className="metric text-foreground text-[0.65rem] font-semibold tracking-wide">
        {code}
      </span>
      <span className="text-muted-foreground w-full truncate text-[0.65rem] leading-tight">
        {copy.label}
      </span>
    </div>
  );
}
