import { cn } from "@/lib/utils";
import { ThroughputMeter } from "@/components/review/throughput-meter";
import type { ReviewCounts, SessionStats } from "@/lib/contracts/review";

/**
 * Review throughput vs. baseline, plus workload remaining (FR-RVW-9, FR-DSH's "reviewer
 * productivity"). Reuses `<ThroughputMeter>` verbatim (`components/review/throughput-
 * meter.tsx`) rather than re-deriving the same "Nx the manual baseline" business-case
 * number a second way — the review queue and the dashboard must always agree on what a
 * throughput multiple means. `sessionStats`/`reviewCounts` are the server-aggregate,
 * whole-queue view (`GET /review/session/stats`, `GET /review/tasks/counts`), not this
 * browser tab's local session — the dashboard reports the population, not one reviewer's
 * sitting.
 */
export function ThroughputPanel({
  sessionStats,
  reviewCounts,
  className,
}: {
  sessionStats: SessionStats;
  reviewCounts: ReviewCounts;
  className?: string;
}) {
  const etaHours =
    sessionStats.ratePerHour > 0 ? reviewCounts.totalOpen / sessionStats.ratePerHour : null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground text-xs font-medium">Workload remaining</span>
        <span className="metric text-foreground text-2xl leading-none font-semibold">
          {reviewCounts.totalOpen}
        </span>
      </div>
      <p className="text-muted-foreground text-xs">
        {etaHours !== null
          ? `~${etaHours < 1 ? "<1" : etaHours.toFixed(1)}h remaining at the current rate`
          : "Rate not yet established this session"}
      </p>
      <ThroughputMeter
        resolvedCount={sessionStats.resolvedCount}
        ratePerHour={sessionStats.ratePerHour}
        medianDecisionMs={sessionStats.medianDecisionMs}
        baselinePerHour={sessionStats.baselinePerHour}
      />
    </div>
  );
}
