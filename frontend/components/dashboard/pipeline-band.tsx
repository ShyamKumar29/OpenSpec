"use client";

/**
 * The enrichment-pipeline band that closes the command center — the horizontal stage
 * readout the reference composition runs under the environment, showing the nine
 * persisted pipeline stages left to right with the in-flight one called out and its real
 * progress alongside.
 *
 * It is deliberately one strip, not a section: the dashboard has to fit a desktop
 * viewport without scrolling, so the band gets a single row of chips and a single row of
 * progress, and everything else about the run lives one click away at `/runs/:id`.
 *
 * It reads `GET /runs?status=running` through the same `useRunsQuery` hook the topbar's
 * `PipelineStrip` and the command center's overview instrument already use, so it shares
 * their cache entry and costs no extra request, and it deliberately does **not** open a
 * second `RunEventSource` — the floating overview instrument above it already owns the
 * stream, and two subscriptions narrating the same run is exactly the kind of duplicate
 * abstraction docs/14-frontend-implementation-plan.md §6 F4 warns against.
 *
 * When nothing is running every stage reads "idle" rather than inventing progress.
 */
import Link from "next/link";
import { ArrowRight, Check, CircleDashed, LoaderCircle, Minus, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGE_CODES, type StageExecution, type StageState } from "@/lib/contracts/run";
import { STAGE_COPY } from "@/lib/run-events/stage-copy";
import { runProgress } from "@/lib/dashboard/run-progress";
import { useRunsQuery } from "@/lib/queries/runs";

type BandState = StageState | "idle";

const STATE_LABEL: Record<BandState, string> = {
  idle: "Idle",
  pending: "Pending",
  running: "Running",
  done: "Done",
  error: "Error",
  skipped: "Skipped",
};

const STATE_ICON: Record<BandState, LucideIcon> = {
  idle: CircleDashed,
  pending: CircleDashed,
  running: LoaderCircle,
  done: Check,
  error: X,
  skipped: Minus,
};

const STATE_ICON_CLASS: Record<BandState, string> = {
  idle: "text-muted-foreground/50",
  pending: "text-muted-foreground/50",
  running: "text-status-needs-review animate-spin motion-reduce:animate-none",
  done: "text-status-accepted",
  error: "text-status-rejected",
  skipped: "text-muted-foreground",
};

export function PipelineBand({ className }: { className?: string }) {
  const running = useRunsQuery({ status: "running" });
  const activeRun = running.data?.items[0] ?? null;

  const byCode = new Map<string, StageExecution>(
    (activeRun?.stages ?? []).map((s) => [s.stage, s]),
  );

  const stages = STAGE_CODES.map((code) => {
    const stage = byCode.get(code);
    return {
      code,
      label: STAGE_COPY[code].label,
      state: (activeRun ? (stage?.state ?? "pending") : "idle") as BandState,
      stage,
    };
  });

  // Stages-complete plus however far into the running stage we are — the run's own
  // persisted counters, never a timer. Shared with the dashboard's active-run hotspot
  // directly above this strip, so the two readouts of one run cannot disagree.
  const { overall, doneCount } = runProgress(activeRun);

  return (
    <section
      data-testid="pipeline-band"
      aria-label="Enrichment pipeline status"
      className={cn(
        "border-border bg-card flex flex-wrap items-center gap-x-3 gap-y-2 rounded-sm border px-3 py-2",
        className,
      )}
    >
      <h2 className="label-caps label-caps-xs text-foreground/70 shrink-0">
        Enrichment
        <br className="hidden 2xl:block" /> pipeline
      </h2>

      <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {stages.map(({ code, label, state }, i) => {
          const Icon = STATE_ICON[state];
          const active = state === "running";
          return (
            <li
              key={code}
              data-testid="pipeline-band-node"
              data-stage={code}
              data-state={state}
              title={`${label} — ${STATE_LABEL[state]}`}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-1 rounded-sm border px-1.5 py-1 transition-colors duration-300",
                active
                  ? "border-status-needs-review/60 bg-status-needs-review-bg"
                  : state === "error"
                    ? "border-status-rejected/50 bg-status-rejected-bg/60"
                    : state === "done"
                      ? "border-status-accepted/35 bg-status-accepted-bg/35"
                      : "border-border bg-muted/40",
              )}
            >
              <Icon className={cn("size-3 shrink-0", STATE_ICON_CLASS[state])} aria-hidden="true" />
              <span
                className={cn(
                  "metric truncate text-[0.625rem] leading-none font-semibold",
                  state === "pending" || state === "idle"
                    ? "text-muted-foreground"
                    : "text-foreground",
                )}
              >
                {code}
              </span>
              {/* Only the in-flight stage spells its name out: nine full labels is what
                  made the old band a section instead of a strip. */}
              {active ? (
                <span className="text-foreground hidden truncate text-[0.625rem] leading-none lg:inline">
                  {label}
                </span>
              ) : null}
              <span className="sr-only">
                Stage {i + 1} of {STAGE_CODES.length} — {label} — {STATE_LABEL[state]}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="flex shrink-0 items-center gap-2">
        <span
          aria-hidden="true"
          className="bg-muted h-1.5 w-20 overflow-hidden rounded-full sm:w-28"
        >
          <span
            className={cn(
              "block h-full transition-[width] duration-700",
              activeRun ? "bg-status-needs-review" : "bg-muted-foreground/30",
            )}
            style={{ width: `${activeRun ? overall : 0}%` }}
          />
        </span>
        <span className="metric text-muted-foreground text-[0.625rem] whitespace-nowrap">
          <span className="text-foreground font-semibold">{activeRun ? overall : 0}%</span> ·{" "}
          {doneCount}/{STAGE_CODES.length}
        </span>
        {activeRun ? (
          <Link
            href={`/runs/${activeRun.id}`}
            data-testid="pipeline-band-view-run"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex shrink-0 items-center gap-1 rounded-sm text-[0.625rem] font-medium focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="hidden truncate sm:inline">
              {activeRun.mpn ?? `${activeRun.kind} run`}
            </span>
            <ArrowRight className="size-3" aria-hidden="true" />
          </Link>
        ) : (
          <span className="text-muted-foreground text-[0.625rem] whitespace-nowrap">Idle</span>
        )}
      </div>
    </section>
  );
}
