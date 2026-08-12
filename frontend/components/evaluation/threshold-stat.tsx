import { CheckCircle2, CircleAlert, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EvalMetric } from "@/lib/contracts/eval";
import { thresholdStatus, type MetricMeta } from "@/lib/evaluation/metric-meta";

/**
 * A lower-is-better metric tile (ECE, over-abstention) — the ceiling-oriented meter
 * language of `components/dashboard/cost-panel.tsx` ("fill toward the target, not away
 * from it"), generalised for a `0..1` rate instead of a dollar figure, plus the Wilson CI
 * every rate in this product carries (ASM-7). Status is communicated as numeral + icon +
 * text together (NFR-ACC-3: never colour alone) — the same discipline
 * `ConfidenceIndicator` applies to attribute-level confidence, applied here to a
 * population-level quality metric.
 */
const STATUS_COPY: Record<
  ReturnType<typeof thresholdStatus>,
  { icon: typeof CheckCircle2; text: string; tone: string }
> = {
  "stretch-met": { icon: CheckCircle2, text: "At stretch", tone: "text-status-accepted" },
  "target-met": { icon: CheckCircle2, text: "Within target", tone: "text-status-accepted" },
  "below-target": { icon: TriangleAlert, text: "Above target", tone: "text-status-rejected" },
  unrated: { icon: CircleAlert, text: "No codified target", tone: "text-muted-foreground" },
};

export function ThresholdStat({
  metric,
  meta,
  formatValue = (v) => `${(v * 100).toFixed(1)}%`,
  className,
}: {
  metric: EvalMetric;
  meta: MetaWithLabel;
  formatValue?: (value: number) => string;
  className?: string;
}) {
  const status = thresholdStatus(metric.value, meta);
  const copy = STATUS_COPY[status];
  const Icon = copy.icon;

  // A ceiling meter needs *some* scale to fill against — 2x the target reads sensibly
  // for both metrics this component renders today (ECE, over-abstention) without a
  // magic per-metric constant.
  const scaleMax = meta.target !== null ? meta.target * 2 : Math.max(metric.value, 0.01) * 1.5;
  const fillPct = Math.min(100, (metric.value / scaleMax) * 100);
  const targetPct = meta.target !== null ? Math.min(100, (meta.target / scaleMax) * 100) : null;
  const stretchPct = meta.stretch !== null ? Math.min(100, (meta.stretch / scaleMax) * 100) : null;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground text-xs font-medium">{meta.label}</span>
        <span className="metric text-foreground text-lg leading-none font-semibold">
          {formatValue(metric.value)}
        </span>
      </div>
      <div className="bg-muted relative h-2.5 overflow-hidden rounded-full">
        <div
          className="bg-chart-3 h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${fillPct}%` }}
        />
        {targetPct !== null ? (
          <span
            aria-hidden="true"
            title={`Target ${formatValue(meta.target!)}`}
            className="bg-foreground/35 absolute top-0 h-full w-px"
            style={{ left: `${targetPct}%` }}
          />
        ) : null}
        {stretchPct !== null ? (
          <span
            aria-hidden="true"
            title={`Stretch ${formatValue(meta.stretch!)}`}
            className="bg-foreground/70 absolute top-0 h-full w-px"
            style={{ left: `${stretchPct}%` }}
          />
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className={cn("inline-flex items-center gap-1 text-[0.7rem] font-medium", copy.tone)}>
          <Icon className="size-3" aria-hidden="true" />
          {copy.text}
        </span>
        <span className="text-muted-foreground metric text-[0.7rem]">
          n={metric.n} · CI [{formatValue(metric.ciLow)}, {formatValue(metric.ciHigh)}]
        </span>
      </div>
      <span className="text-muted-foreground text-[0.65rem]">
        {meta.requirement}
        {meta.target !== null ? ` · target ≤${formatValue(meta.target)}` : ""}
        {meta.stretch !== null ? ` · stretch ≤${formatValue(meta.stretch)}` : ""}
      </span>
    </div>
  );
}

type MetaWithLabel = MetricMeta;
