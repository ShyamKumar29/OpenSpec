"use client";

/**
 * The dashboard's central operational visualization — "what is OpenSpec doing right
 * now" (F6 brief, viewport requirement #1). Narrates the pipeline stage-by-stage for
 * whichever run is currently `status: "running"` in the fixture universe, reusing the
 * exact same `RunEventSource`/`useRunStream` port Judge Mode and `/runs/:id` are built on
 * (docs/14-frontend-implementation-plan.md §6 F4) — nothing here is a second, dashboard-
 * specific run abstraction, and nothing here is fabricated: every stage, every count, and
 * every dollar is the real scripted run's own data (`run_batch_in_flight`,
 * mocks/fixtures/runs.ts), streamed through the same mock SSE endpoint `/runs/:id/events`
 * hits everywhere else it's used.
 *
 * If no run is currently `running` (not the common case in this fixture universe, but a
 * real possibility once a batch finishes or if the fixtures ever change), this renders an
 * honest idle state rather than looping stale narration.
 */
import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGE_CODES } from "@/lib/contracts/run";
import { PipelineNode } from "./pipeline-node";
import { LiveStatsBar } from "@/components/judge/live-stats-bar";
import { LoadingBlock } from "@/components/state/loading";
import { ErrorState } from "@/components/state/error-state";
import { useRunDetailQuery, useRunsQuery } from "@/lib/queries/runs";
import { useRunStream } from "@/lib/run-events/use-run-stream";
import { mergeAuthoritativeStages } from "@/lib/run-events/merge-authoritative-stages";

export function OperationsPulse({
  className,
  dense = false,
}: {
  className?: string;
  /** The command center floats this instrument over the environment, where it has about
   *  a third of the hero's height to fit nine stages into. `dense` tightens the rows and
   *  drops the run-id line; nothing is removed that isn't also on screen elsewhere (the
   *  live counters move to the operational-state summary beside it, and the run id is one
   *  click away behind "View run"). */
  dense?: boolean;
}) {
  const runningRuns = useRunsQuery({ status: "running" });
  const activeRun = runningRuns.data?.items[0] ?? null;

  const detail = useRunDetailQuery(activeRun?.id ?? null);
  const stream = useRunStream(activeRun?.id ?? null);
  const { setTarget } = stream;

  useEffect(() => {
    if (!detail.data) return;
    setTarget({
      liveExtracted: detail.data.liveExtracted,
      liveUnknown: detail.data.liveUnknown,
      liveRejected: detail.data.liveRejected,
    });
  }, [detail.data, setTarget]);

  if (runningRuns.status === "pending") {
    return <LoadingBlock rows={3} className={className} />;
  }

  if (runningRuns.status === "error") {
    return (
      <ErrorState
        error={runningRuns.error}
        onRetry={() => runningRuns.refetch()}
        className={className}
      />
    );
  }

  if (!activeRun) {
    return (
      <div
        className={cn(
          "border-border flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center",
          className,
        )}
      >
        <PauseCircle className="text-muted-foreground size-6" aria-hidden="true" />
        <p className="text-foreground text-sm font-medium">No enrichment run in progress</p>
        <p className="text-muted-foreground max-w-sm text-xs">
          Nothing is currently running — start one from{" "}
          <Link href="/judge" className="underline underline-offset-2">
            Judge Mode
          </Link>{" "}
          to see it narrated here live.
        </p>
      </div>
    );
  }

  // The stream deliberately narrates from `pending` forward (that is what makes Judge
  // Mode and `/runs/:id` feel live). On a glance surface that opening frame would
  // misreport a run that has genuinely already finished four stages, so the run's own
  // persisted `stages` from `GET /runs/{id}` act as the floor and the narration takes
  // over the moment it has anything to add (`mergeAuthoritativeStages`). Nothing about
  // the stream itself changes — this is a display merge, not a second event source.
  const stages = mergeAuthoritativeStages(stream.state.stages, detail.data?.stages);
  const doneCount = STAGE_CODES.filter((c) => stages[c].state === "done").length;

  return (
    <div data-testid="operations-pulse" className={cn("flex flex-col", className)}>
      <div
        className={cn(
          "border-border flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b px-3",
          dense ? "py-1.5" : "py-2",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex size-2 shrink-0" aria-hidden="true">
            <span className="bg-status-needs-review absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 motion-reduce:animate-none" />
            <span className="bg-status-needs-review relative inline-flex size-2 rounded-full" />
          </span>
          <h2 className={cn("label-caps text-foreground/80 truncate", dense && "label-caps-sm")}>
            Run / system overview
          </h2>
        </div>
        <Link
          href={`/runs/${activeRun.id}`}
          data-testid="operations-pulse-view-run"
          className={cn(
            "text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex shrink-0 items-center gap-1 rounded-sm font-medium focus-visible:ring-2 focus-visible:outline-none",
            dense ? "text-[0.625rem]" : "text-xs",
          )}
        >
          View run <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      </div>

      {dense ? null : (
        <p className="text-muted-foreground metric border-border truncate border-b px-3 py-1.5 text-[0.6875rem]">
          {activeRun.mpn ?? `${activeRun.kind} run`} · {activeRun.id}
        </p>
      )}

      <ol aria-label="Pipeline stages" className={cn("divide-border divide-y", !dense && "py-0.5")}>
        {STAGE_CODES.map((code) => (
          <li key={code}>
            <PipelineNode code={code} stage={stages[code]} layout="row" dense={dense} />
          </li>
        ))}
      </ol>

      <div
        className={cn(
          "border-border metric text-muted-foreground border-t px-3",
          dense ? "py-0.5 text-[0.625rem]" : "py-1.5 text-[0.6875rem]",
        )}
      >
        Stages complete: <span className="text-foreground">{doneCount}</span>/{STAGE_CODES.length}
      </div>

      {dense ? (
        // The same four live counters as `LiveStatsBar`, folded onto one line. The
        // command center floats this panel over the environment and cannot spare the
        // 60px the full bar needs; the numbers themselves are not negotiable.
        <p className="border-border metric text-muted-foreground flex flex-wrap gap-x-2 border-t px-3 py-0.5 text-[0.625rem]">
          <span>
            <span className="text-foreground">{stream.state.liveExtracted}</span> extracted
          </span>
          <span>
            · <span className="text-foreground">{stream.state.liveUnknown}</span> unknown
          </span>
          <span>
            · <span className="text-foreground">{stream.state.liveRejected}</span> rejected
          </span>
          <span>· ${stream.state.costSoFar.toFixed(3)}</span>
        </p>
      ) : (
        <LiveStatsBar
          liveExtracted={stream.state.liveExtracted}
          liveUnknown={stream.state.liveUnknown}
          liveRejected={stream.state.liveRejected}
          costSoFar={stream.state.costSoFar}
          className="border-border rounded-none border-0 border-t bg-transparent p-3"
        />
      )}
    </div>
  );
}
