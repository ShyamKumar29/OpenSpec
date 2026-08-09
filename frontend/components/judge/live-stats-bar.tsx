import { formatCostUsd } from "@/lib/format/run";
import { cn } from "@/lib/utils";

/** "Live: 14 extracted · 3 unknown · 0 rejected      Cost so far: $0.041"
 *  (docs/06-frontend.md §3.4) — every number here is derived, never typed by this
 *  component (see `lib/run-events/reducer.ts`). Deliberately NOT `aria-live` — it ticks
 *  every few hundred ms while a stage is running, which would be constant screen-reader
 *  chatter; the meaningful announcement is the terminal result (`LiveResultPanel`),
 *  which does carry `aria-live`. */
export function LiveStatsBar({
  liveExtracted,
  liveUnknown,
  liveRejected,
  costSoFar,
  className,
}: {
  liveExtracted: number;
  liveUnknown: number;
  liveRejected: number;
  costSoFar: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border bg-muted/30 metric flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border px-3 py-2 text-xs",
        className,
      )}
    >
      <span className="text-foreground">
        <span className="text-muted-foreground font-sans">Live: </span>
        {liveExtracted} extracted · {liveUnknown} unknown · {liveRejected} rejected
      </span>
      <span className="text-muted-foreground">
        Cost so far: <span className="text-foreground">{formatCostUsd(costSoFar)}</span>
      </span>
    </div>
  );
}
