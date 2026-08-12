import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format/percent";
import type { EvalMetric } from "@/lib/contracts/eval";
import type { MetricMeta } from "@/lib/evaluation/metric-meta";

/**
 * A rate reported "for completeness" (docs/03-ai-pipeline.md §8.3 lists `recall` as a
 * metric every run produces) that carries no codified QR target — rendered as numeral +
 * Wilson CI without a meter or a pass/fail judgement, so the page never implies a
 * threshold the requirements doc doesn't actually state (CLAUDE.md: "If something is
 * ambiguous, prefer the option that produces less output and more evidence" — here, that
 * means *not* drawing a target tick we'd have to invent).
 */
export function PlainRateStat({
  metric,
  meta,
  className,
}: {
  metric: EvalMetric;
  meta: MetricMeta;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground text-xs font-medium">{meta.label}</span>
        <span className="metric text-foreground text-lg leading-none font-semibold">
          {formatPercent(metric.value)}
        </span>
      </div>
      <div className="text-muted-foreground metric flex flex-wrap items-center justify-between gap-x-2 text-[0.7rem]">
        <span>
          n={metric.n} · CI [{formatPercent(metric.ciLow)}, {formatPercent(metric.ciHigh)}]
        </span>
        <span>{meta.requirement}</span>
      </div>
    </div>
  );
}
