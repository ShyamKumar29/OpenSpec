import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Session: 47 resolved · 38/hr · median 71s Baseline manual: ~7/hr" (docs/06-frontend.md
 * §3.3) — the reviewer's screen doubling as the FR-RVW-9 business case. In this version,
 * `resolvedCount`/`ratePerHour`/`medianDecisionMs` are measured from real decisions made
 * in this browser tab (lib/review/session-storage.ts's `computeLocalThroughput`), not the
 * mock's fixed constants — the meter genuinely moves as the reviewer works, from the
 * first version (docs/06-frontend.md Recommendation 2, risk E3). `baselinePerHour` is the
 * one number that legitimately comes from the server (`GET /review/session/stats`,
 * standing in for a configurable manual baseline).
 */
export function ThroughputMeter({
  resolvedCount,
  ratePerHour,
  medianDecisionMs,
  baselinePerHour,
  className,
}: {
  resolvedCount: number;
  ratePerHour: number;
  medianDecisionMs: number | null;
  baselinePerHour: number;
  className?: string;
}) {
  const multiple = ratePerHour > 0 && baselinePerHour > 0 ? ratePerHour / baselinePerHour : null;

  return (
    <div
      data-testid="throughput-meter"
      className={cn(
        "border-border bg-muted/30 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 rounded-lg border px-3 py-2 text-xs",
        className,
      )}
    >
      <p className="text-muted-foreground metric">
        Session: <span className="text-foreground font-medium">{resolvedCount} resolved</span>
        {" · "}
        <span className="text-foreground font-medium">{ratePerHour.toFixed(1)}/hr</span>
        {medianDecisionMs !== null ? (
          <>
            {" · median "}
            <span className="text-foreground font-medium">
              {Math.round(medianDecisionMs / 1000)}s
            </span>
          </>
        ) : null}
      </p>
      <p className="metric text-muted-foreground flex items-center gap-1.5">
        <span>
          Baseline (manual):{" "}
          <span className="text-foreground font-medium">~{baselinePerHour}/hr</span>
        </span>
        {multiple !== null ? (
          <span
            className="text-status-accepted inline-flex items-center gap-1 font-medium"
            title={`${multiple.toFixed(1)}x the configured manual baseline`}
          >
            <TrendingUp className="size-3.5" aria-hidden="true" />
            {multiple.toFixed(1)}×
          </span>
        ) : null}
      </p>
    </div>
  );
}
