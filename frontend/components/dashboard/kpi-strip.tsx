import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { plotSparkline, sparklinePath } from "@/lib/dashboard/sparkline";

export interface KpiDelta {
  direction: "up" | "down";
  /** e.g. "+3pts vs last eval run" — the full, human-readable comparison, not just the
   *  number, so the delta is meaningful without a legend. */
  label: string;
  /** Whether *this direction, for this metric* is the good outcome — an Unknown count
   *  going up is bad; a throughput multiple going up is good. Colour follows this, never
   *  the raw sign (NFR-ACC-3: numeral + icon + text together, never colour alone). */
  good: boolean;
}

/** A measured value against the target it is judged by. `met` is passed in rather than
 *  computed here because "good" is direction-dependent — an STP rate wants to be *above*
 *  its target, a cost/SKU below it. */
export interface KpiMeter {
  /** 0..1 fill. */
  fraction: number;
  /** 0..1 position of the target tick, or `null` for a bar with no marked target. */
  targetFraction: number | null;
  met: boolean;
}

/** One tile in the horizontal KPI strip — the first-viewport "what matters right now"
 *  row (docs/14-frontend-implementation-plan.md §6 F6 brief). Every tile is optionally a
 *  link straight into the page that owns the underlying data (catalog, review, runs),
 *  so the dashboard is a jumping-off point, not a dead end.
 *
 *  `meter` and `series` are strictly optional and strictly real: a tile only gets a bar
 *  when the metric genuinely has a target, and only gets a sparkline when a real series
 *  exists behind it (the evaluation runs from `GET /metrics/quality-trend`). A decorative
 *  squiggle under a number the system cannot actually trend would be the exact failure
 *  this product exists to avoid. */
export function KpiTile({
  icon: Icon,
  label,
  value,
  detail,
  delta,
  meter,
  series,
  href,
  testId,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
  delta?: KpiDelta;
  meter?: KpiMeter;
  series?: number[];
  href?: string;
  testId?: string;
  className?: string;
}) {
  // Cells in a divided bar rather than free-floating cards — the reference composition's
  // bottom metrics rail, read as a command-center status bar. The dividing hairline is
  // owned by `KpiStrip` below so the cells sit flush against one another, and the whole
  // rail is sized to be supporting information under the hero, never a row of cards
  // competing with it.
  const tileClass = cn(
    "bg-card flex min-w-[6.25rem] flex-1 flex-col justify-between gap-1.5 px-2.5 py-2 transition-colors",
    href && "hover:bg-accent/50",
    className,
  );

  const plotted =
    series && series.length > 1
      ? plotSparkline(
          series.map((y, x) => ({ x, y })),
          64,
          18,
          3,
        )
      : null;

  const inner = (
    <>
      <span className="label-caps label-caps-xs text-muted-foreground flex items-center gap-1">
        <Icon className="size-3 shrink-0" aria-hidden="true" />
        <span className="min-w-0 truncate">{label}</span>
      </span>
      <span className="flex items-end justify-between gap-2">
        <span className="metric text-foreground text-xl leading-none font-bold">{value}</span>
        {plotted ? (
          <svg
            viewBox="0 0 64 18"
            className="h-[14px] w-12 shrink-0 overflow-visible"
            aria-hidden="true"
            focusable="false"
            preserveAspectRatio="none"
          >
            <path
              d={sparklinePath(plotted)}
              fill="none"
              stroke="var(--chart-2)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx={plotted[plotted.length - 1].px}
              cy={plotted[plotted.length - 1].py}
              r="2"
              fill="var(--chart-1)"
            />
          </svg>
        ) : null}
      </span>
      {meter ? (
        <span aria-hidden="true" className="bg-muted relative block h-1 w-full rounded-full">
          <span
            className={cn(
              "block h-full rounded-full",
              meter.met ? "bg-status-accepted" : "bg-status-needs-review",
            )}
            style={{ width: `${Math.min(100, Math.max(0, meter.fraction * 100))}%` }}
          />
          {meter.targetFraction !== null ? (
            <span
              className="bg-foreground/70 absolute top-[-2px] h-[8px] w-px"
              style={{ left: `${Math.min(100, Math.max(0, meter.targetFraction * 100))}%` }}
            />
          ) : null}
        </span>
      ) : null}
      {detail || delta ? (
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] leading-tight">
          {delta ? (
            <span
              className={cn(
                "metric inline-flex items-center gap-0.5 font-medium",
                delta.good ? "text-status-accepted" : "text-status-rejected",
              )}
            >
              {delta.direction === "up" ? (
                <TrendingUp className="size-3" aria-hidden="true" />
              ) : (
                <TrendingDown className="size-3" aria-hidden="true" />
              )}
              {delta.label}
            </span>
          ) : null}
          {detail ? <span className="text-muted-foreground">{detail}</span> : null}
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} data-testid={testId} className={tileClass}>
        {inner}
      </Link>
    );
  }
  return (
    <div data-testid={testId} className={tileClass}>
      {inner}
    </div>
  );
}

export function KpiStrip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border divide-border flex flex-wrap divide-x divide-y rounded-sm border",
        className,
      )}
      role="group"
      aria-label="Key operational metrics"
    >
      {children}
    </div>
  );
}
