import { cn } from "@/lib/utils";
import type { Throughput } from "@/lib/contracts/eval";

/** NFR-CST-1: ≤$0.12/SKU target, ≤$0.05/SKU stretch. "A single ratio against a limit" —
 *  the meter form again, ceiling-oriented (lower fill is better, unlike the STP meters
 *  where higher is better) — the fill and the tick are the same visual language as
 *  `StpMeters` on purpose, so a reader learns the encoding once. */
const TARGET_USD = 0.12;
const STRETCH_USD = 0.05;

export function CostPanel({
  throughput,
  className,
}: {
  throughput: Throughput;
  className?: string;
}) {
  const fillPct = Math.min(100, (throughput.costPerSkuUsd / TARGET_USD) * 100);
  const stretchPct = (STRETCH_USD / TARGET_USD) * 100;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground text-xs font-medium">Cost per SKU</span>
        <span className="metric text-foreground text-2xl leading-none font-semibold">
          ${throughput.costPerSkuUsd.toFixed(3)}
        </span>
      </div>
      <div className="bg-muted relative h-2.5 overflow-hidden rounded-full">
        <div
          className="bg-chart-3 h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${fillPct}%` }}
        />
        <span
          aria-hidden="true"
          title={`Stretch ≤$${STRETCH_USD.toFixed(2)}`}
          className="bg-foreground/70 absolute top-0 h-full w-px"
          style={{ left: `${stretchPct}%` }}
        />
      </div>
      <div className="text-muted-foreground metric flex flex-wrap items-center justify-between gap-x-2 text-[0.7rem]">
        <span>{throughput.skusPerHour}/hr throughput</span>
        <span>
          NFR-CST-1 · target ≤${TARGET_USD.toFixed(2)} · stretch ≤${STRETCH_USD.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
