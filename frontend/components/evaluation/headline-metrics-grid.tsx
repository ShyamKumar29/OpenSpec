import { Meter } from "@/components/dashboard/stp-meters";
import { PlainRateStat } from "./plain-rate-stat";
import { ThresholdStat } from "./threshold-stat";
import { SourceBadge, EvalRunSourceLine } from "./source-badge";
import { metricMeta } from "@/lib/evaluation/metric-meta";
import { cn } from "@/lib/utils";
import type { EvalMetric } from "@/lib/contracts/eval";

/**
 * The six headline gold-set metrics for the selected eval run, each traced to its QR
 * target (risk E4, "vanity metrics", designed out the same way `DashboardCard`'s
 * `requirement` prop does). `stp_all_mandatory` / `stp_auto_eligible_only` / `precision`
 * reuse `Meter` from `components/dashboard/stp-meters.tsx` verbatim — Dashboard and
 * Evaluation render the *same* STP number the *same* way rather than each computing or
 * drawing it independently (session brief: "reuse existing dashboard metric definitions
 * ... rather than maintaining duplicate calculations").
 */
function findMetric(metrics: EvalMetric[], code: string): EvalMetric | undefined {
  return metrics.find((m) => m.metricCode === code);
}

export function HeadlineMetricsGrid({
  headlineMetrics,
  runId,
  goldSetVersion,
  className,
}: {
  headlineMetrics: EvalMetric[];
  runId: string;
  goldSetVersion: string;
  className?: string;
}) {
  const stpAll = findMetric(headlineMetrics, "stp_all_mandatory");
  const stpAuto = findMetric(headlineMetrics, "stp_auto_eligible_only");
  const precision = findMetric(headlineMetrics, "precision");
  const recall = findMetric(headlineMetrics, "recall");
  const ece = findMetric(headlineMetrics, "ece");
  const overAbstention = findMetric(headlineMetrics, "over_abstention_rate");
  const allReal = headlineMetrics.length > 0 && headlineMetrics.every((m) => m.isReal);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-foreground text-sm font-semibold">Headline metrics — gold set</h3>
        <div className="flex items-center gap-2">
          <SourceBadge isReal={allReal} />
          <EvalRunSourceLine runId={runId} goldSetVersion={goldSetVersion} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
        {stpAll ? (
          <Meter
            label={metricMeta("stp_all_mandatory").label}
            metric={stpAll}
            target={metricMeta("stp_all_mandatory").target!}
            stretch={metricMeta("stp_all_mandatory").stretch!}
            requirement={metricMeta("stp_all_mandatory").requirement}
          />
        ) : null}
        {stpAuto ? (
          <Meter
            label={metricMeta("stp_auto_eligible_only").label}
            metric={stpAuto}
            target={metricMeta("stp_auto_eligible_only").target!}
            stretch={metricMeta("stp_auto_eligible_only").stretch!}
            requirement={metricMeta("stp_auto_eligible_only").requirement}
          />
        ) : null}
        {precision ? (
          <Meter
            label={metricMeta("precision").label}
            metric={precision}
            target={metricMeta("precision").target!}
            stretch={metricMeta("precision").stretch!}
            requirement={metricMeta("precision").requirement}
          />
        ) : null}
        {recall ? <PlainRateStat metric={recall} meta={metricMeta("recall")} /> : null}
        {ece ? (
          <ThresholdStat metric={ece} meta={metricMeta("ece")} formatValue={(v) => v.toFixed(3)} />
        ) : null}
        {overAbstention ? (
          <ThresholdStat metric={overAbstention} meta={metricMeta("over_abstention_rate")} />
        ) : null}
      </div>
    </div>
  );
}
