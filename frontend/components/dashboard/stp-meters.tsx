import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format/percent";
import type { EvalMetric } from "@/lib/contracts/eval";

/**
 * Straight-through-processing meters — "a single ratio against a limit" (dataviz skill:
 * meter form). Two, per QR-3/QR-4: all mandatory attributes, and auto-eligible attributes
 * only (`01-requirements.md` §1.1: risk tiers cap all-mandatory STP at ~73% by design —
 * the target/stretch ticks make that ceiling visible rather than implying 100% is the
 * goal). Wilson confidence intervals are shown alongside the point estimate (ASM-7:
 * "never bare point estimates") even here, ahead of F7's dedicated treatment.
 */
interface MeterSpec {
  label: string;
  metric: EvalMetric;
  target: number;
  stretch: number;
  requirement: string;
}

/** Exported for reuse by `/evaluation` (`components/evaluation/rate-meter.tsx` composes
 *  the same higher-is-better meter for precision, rather than re-deriving this visual
 *  language a second way — Dashboard and Evaluation must render identical metrics
 *  identically). */
export function Meter({ label, metric, target, stretch, requirement }: MeterSpec) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground text-xs font-medium">{label}</span>
        <span className="metric text-foreground text-lg leading-none font-semibold">
          {formatPercent(metric.value)}
        </span>
      </div>
      <div className="bg-muted relative h-2.5 overflow-hidden rounded-full">
        <div
          className="bg-chart-3 h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${Math.min(100, metric.value * 100)}%` }}
        />
        <span
          aria-hidden="true"
          title={`Target ${formatPercent(target)}`}
          className="bg-foreground/35 absolute top-0 h-full w-px"
          style={{ left: `${target * 100}%` }}
        />
        <span
          aria-hidden="true"
          title={`Stretch ${formatPercent(stretch)}`}
          className="bg-foreground/70 absolute top-0 h-full w-px"
          style={{ left: `${stretch * 100}%` }}
        />
      </div>
      <div className="text-muted-foreground metric flex flex-wrap items-center justify-between gap-x-2 text-[0.7rem]">
        <span>
          n={metric.n} · CI [{formatPercent(metric.ciLow)}, {formatPercent(metric.ciHigh)}]
        </span>
        <span>
          {requirement} · target {formatPercent(target)} · stretch {formatPercent(stretch)}
        </span>
      </div>
    </div>
  );
}

export function StpMeters({
  allMandatory,
  autoEligible,
  className,
}: {
  allMandatory: EvalMetric;
  autoEligible: EvalMetric;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <Meter
        label="All mandatory attributes"
        metric={allMandatory}
        target={0.55}
        stretch={0.7}
        requirement="QR-3"
      />
      <Meter
        label="Auto-eligible attributes only"
        metric={autoEligible}
        target={0.75}
        stretch={0.9}
        requirement="QR-4"
      />
    </div>
  );
}
