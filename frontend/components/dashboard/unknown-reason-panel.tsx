import { cn } from "@/lib/utils";
import { UNKNOWN_REASON_COPY, type UnknownReasonCopy } from "@/lib/format/unknown-reason";
import type { CatalogHealth } from "@/lib/contracts/eval";

const REASON_COPY = UNKNOWN_REASON_COPY as Record<string, UnknownReasonCopy>;

/**
 * `Unknown` reason-code breakdown, routed by fix owner (`01-requirements.md` §1.2: "your
 * 34% Unknown rate is six problems, and four of them are document sourcing, not AI").
 * More than seven categories carry meaning here (up to all thirteen closed-set codes),
 * so this is the dataviz skill's "table (or table + chart)" form rather than a legend of
 * a dozen hues — magnitude is a single grayscale bar per row; identity (which reason,
 * which owner) is carried by text, never colour, matching this app's existing never-
 * colour-alone discipline (NFR-ACC-3) for status and confidence.
 */
export function UnknownReasonPanel({
  breakdown,
  className,
}: {
  breakdown: CatalogHealth["unknownReasonBreakdown"];
  className?: string;
}) {
  const sorted = [...breakdown].sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...sorted.map((r) => r.count));

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="text-muted-foreground flex items-center justify-between px-0.5 text-[0.65rem] font-medium tracking-wide uppercase">
        <span>Reason → fix owner</span>
        <span>Count</span>
      </div>
      <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
        {sorted.map((r) => {
          const copy = REASON_COPY[r.reason];
          return (
            <li key={r.reason} className="flex flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-foreground truncate text-xs font-medium">
                  {copy?.label ?? r.reason}
                </span>
                <span className="metric text-foreground shrink-0 text-xs font-semibold">
                  {r.count}
                </span>
              </div>
              <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                <div
                  className="bg-chart-3 h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
              </div>
              <span className="text-muted-foreground text-[0.65rem]">→ {r.fixOwner}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
