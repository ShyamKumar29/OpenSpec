"use client";

/**
 * The topbar's pipeline stage row.
 *
 * The Stitch export puts a row of stage names (CLASSIFY · SCHEMA · EXTRACT · VERIFY ·
 * VALIDATE · NORMALIZE) across the top chrome of every page, styled as navigation. In
 * OpenSpec those aren't routes — they're the persisted pipeline's stages
 * (`STAGE_CODES`, docs/06-frontend.md §3.4). Rendering them as links to pages that don't
 * exist would be decoration pretending to be navigation, so instead this renders them as
 * what they actually are: a live, glanceable status readout of the currently in-flight
 * run, sourced from the same `GET /runs` the dashboard's active-runs panel uses. It is
 * chrome that carries information.
 *
 * When nothing is running, every stage reads "idle" rather than inventing progress.
 */
import Link from "next/link";
import { cn } from "@/lib/utils";
import { STAGE_CODES, type StageState } from "@/lib/contracts/run";
import { STAGE_COPY } from "@/lib/run-events/stage-copy";
import { useRunsQuery } from "@/lib/queries/runs";

const STATE_LABEL: Record<StageState | "idle", string> = {
  idle: "Idle",
  pending: "Pending",
  running: "Running",
  done: "Done",
  error: "Error",
  skipped: "Skipped",
};

/** Dot colours are fixed to the dark-surface end of the status palette because this
 *  strip always sits on the near-black chrome bar, in both themes. They are decorative:
 *  every stage also carries its code as text plus an `sr-only` state word, so nothing
 *  here is encoded by colour alone (NFR-ACC-3). */
const DOT_CLASS: Record<StageState | "idle", string> = {
  idle: "bg-chrome-foreground/25",
  pending: "bg-chrome-foreground/25",
  running: "bg-[#e5b165]",
  done: "bg-[#79d18b]",
  error: "bg-[#f09a92]",
  skipped: "bg-chrome-foreground/40",
};

export function PipelineStrip({ className }: { className?: string }) {
  const running = useRunsQuery({ status: "running" });
  const activeRun = running.data?.items[0] ?? null;

  const stateByCode = new Map<string, StageState>(
    (activeRun?.stages ?? []).map((s) => [s.stage, s.state]),
  );

  const items = STAGE_CODES.map((code) => ({
    code,
    label: STAGE_COPY[code].label,
    state: (activeRun ? (stateByCode.get(code) ?? "pending") : "idle") as StageState | "idle",
  }));

  const body = (
    <ol
      className="flex items-center gap-3"
      aria-label={
        activeRun
          ? `Pipeline stage status for the active run ${activeRun.id}`
          : "Pipeline stage status — no run in progress"
      }
    >
      {items.map((item) => (
        <li key={item.code} className="flex items-center gap-1.5" title={item.label}>
          <span aria-hidden="true" className={cn("size-1.5 rounded-full", DOT_CLASS[item.state])} />
          <span
            className={cn(
              "label-caps text-[10px]",
              item.state === "running"
                ? "text-chrome-foreground"
                : item.state === "done"
                  ? "text-chrome-foreground/85"
                  : "text-chrome-foreground/60",
            )}
          >
            {item.code}
          </span>
          <span className="sr-only">
            {item.label} — {STATE_LABEL[item.state]}
          </span>
        </li>
      ))}
    </ol>
  );

  if (!activeRun) {
    return <div className={cn("hidden xl:block", className)}>{body}</div>;
  }

  return (
    <Link
      href={`/runs/${activeRun.id}`}
      className={cn(
        "focus-visible:ring-chrome-foreground hidden rounded-sm focus-visible:ring-2 focus-visible:outline-none xl:block",
        className,
      )}
    >
      {body}
    </Link>
  );
}

/** The "LIVE STATUS" pill from the Stitch topbar, wired to the same run query — green and
 *  pulsing only when a run genuinely is in flight. */
export function LiveStatusPill({ className }: { className?: string }) {
  const running = useRunsQuery({ status: "running" });
  const count = running.data?.items.length ?? 0;
  const live = count > 0;

  return (
    <span
      data-testid="live-status-pill"
      className={cn(
        "border-chrome-border bg-chrome-accent hidden items-center gap-2 rounded-sm border px-2.5 py-1 sm:inline-flex",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          live
            ? "animate-pulse bg-[#79d18b] motion-reduce:animate-none"
            : "bg-chrome-foreground/35",
        )}
      />
      <span className="label-caps text-chrome-foreground text-[10px]">
        {live ? "Live" : "Idle"}
      </span>
      <span className="sr-only">
        {live
          ? `${count} enrichment run${count === 1 ? "" : "s"} in progress`
          : "No enrichment run in progress"}
      </span>
    </span>
  );
}
