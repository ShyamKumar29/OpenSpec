import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format/percent";
import { plotSparkline, sparklinePath } from "@/lib/dashboard/sparkline";
import type { QualityTrend } from "@/lib/contracts/eval";

/**
 * Quality trend across eval runs (FR-DSH-4). Two small-multiple sparklines — STP and
 * precision — never one chart on two y-axes (dataviz skill's #1 anti-pattern: they move
 * on very different scales, ~55% vs ~98%, so sharing an axis would flatten precision to a
 * near-straight line at the top). Each carries a permanent "real slice" label
 * (docs/14-frontend-implementation-plan.md §3 C2 / O4): every metric here is `is_real`
 * today, but the label is a structural control, not a one-time fact, so it stays even
 * once a synthetic slice exists.
 */
const CHART_WIDTH = 220;
const CHART_HEIGHT = 48;

function TrendCard({
  title,
  requirement,
  series,
}: {
  title: string;
  requirement: string;
  series: { startedAt: string; value: number; isReal: boolean }[];
}) {
  if (series.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs font-medium">{title}</span>
        <p className="text-muted-foreground text-xs">No eval runs yet.</p>
      </div>
    );
  }

  const first = series[0];
  const last = series[series.length - 1];
  const delta = last.value - first.value;
  const isReal = series.every((p) => p.isReal);

  const plotted = plotSparkline(
    series.map((p, i) => ({ x: i, y: p.value })),
    CHART_WIDTH,
    CHART_HEIGHT,
  );
  const path = sparklinePath(plotted);
  const lastPoint = plotted[plotted.length - 1];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs font-medium">{title}</span>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold tracking-wide uppercase",
            isReal
              ? "bg-status-accepted-bg text-status-accepted"
              : "bg-status-needs-review-bg text-status-needs-review",
          )}
        >
          {isReal ? "Real slice" : "Synthetic slice"}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="metric text-foreground text-xl font-semibold">
          {formatPercent(last.value)}
        </span>
        <span
          className={cn(
            "metric text-xs font-medium",
            delta >= 0 ? "text-status-accepted" : "text-status-rejected",
          )}
        >
          {delta >= 0 ? "+" : ""}
          {Math.round(delta * 100)}pts vs {series.length - 1} run
          {series.length - 1 === 1 ? "" : "s"} ago
        </span>
      </div>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`${title} trend across ${series.length} eval runs: ${series
          .map((p) => formatPercent(p.value))
          .join(" → ")}`}
      >
        <path
          d={path}
          fill="none"
          className="stroke-chart-3"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {lastPoint ? (
          <circle
            cx={lastPoint.px}
            cy={lastPoint.py}
            r={4}
            className="fill-chart-4"
            stroke="var(--card)"
            strokeWidth={2}
          />
        ) : null}
      </svg>
      <span className="text-muted-foreground text-[0.65rem]">
        {requirement} · {series.length} eval runs, oldest → newest
      </span>
    </div>
  );
}

function seriesFor(trend: QualityTrend, metricCode: string) {
  return trend.series
    .map((run) => {
      const m = run.metrics.find((mm) => mm.metricCode === metricCode);
      return m ? { startedAt: run.startedAt, value: m.value, isReal: m.isReal } : null;
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
}

export function QualityTrendChart({
  trend,
  className,
}: {
  trend: QualityTrend;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", className)}>
      <TrendCard
        title="STP (all mandatory)"
        requirement="QR-3"
        series={seriesFor(trend, "stp_all_mandatory")}
      />
      <TrendCard
        title="Precision (auto-accepted)"
        requirement="QR-1 / QR-2"
        series={seriesFor(trend, "precision")}
      />
    </div>
  );
}
