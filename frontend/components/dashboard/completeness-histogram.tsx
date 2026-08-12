import { cn } from "@/lib/utils";
import type { CatalogHealth } from "@/lib/contracts/eval";

/** Sequential, one-hue-lighter-to-darker magnitude bars (dataviz skill: "compare
 *  magnitude, low -> high" -> bar chart, sequential colour) — the `--chart-*` tokens
 *  are already a plain achromatic ramp (see app/globals.css), so "one hue" here is
 *  literally the app's existing grayscale, not a new palette. Bucket count relative to
 *  the largest bucket, not to 100%, so the bar that dominates the catalog is always the
 *  fullest one. */
const BUCKET_SHADE = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4"];

export function CompletenessHistogram({
  distribution,
  className,
}: {
  distribution: CatalogHealth["completenessDistribution"];
  className?: string;
}) {
  const max = Math.max(1, ...distribution.map((d) => d.count));
  return (
    <div
      role="img"
      aria-label={`Completeness distribution: ${distribution
        .map((d) => `${d.count} records at ${d.bucket} complete`)
        .join(", ")}`}
      className={cn("flex flex-col gap-1.5", className)}
    >
      {distribution.map((d, i) => (
        <div key={d.bucket} className="flex items-center gap-2">
          <span className="text-muted-foreground w-14 shrink-0 text-xs">{d.bucket}</span>
          <div className="bg-muted h-3 flex-1 overflow-hidden rounded-sm">
            <div
              className={cn(
                "h-full rounded-sm transition-[width] duration-500 motion-reduce:transition-none",
                BUCKET_SHADE[i] ?? "bg-chart-4",
              )}
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
          <span className="metric text-foreground w-8 shrink-0 text-right text-xs font-medium">
            {d.count}
          </span>
        </div>
      ))}
    </div>
  );
}
