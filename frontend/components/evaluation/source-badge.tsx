import { cn } from "@/lib/utils";

/**
 * The real/synthetic label FR-EVL-4 requires on every metric block (docs/14-frontend-
 * implementation-plan.md §3 C2/O4: "a permanent, non-removable source label"). Same
 * visual language as `components/dashboard/quality-trend-chart.tsx`'s inline badge —
 * factored out here so every eval surface (headline tiles, slice table, ablation table)
 * renders the same badge rather than three near-identical ones.
 */
export function SourceBadge({ isReal, className }: { isReal: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold tracking-wide uppercase",
        isReal
          ? "bg-status-accepted-bg text-status-accepted"
          : "bg-status-needs-review-bg text-status-needs-review",
        className,
      )}
    >
      {isReal ? "Real slice" : "Synthetic slice"}
    </span>
  );
}

/** "Source: eval run <id> · gold set v1.4" — the per-block provenance line, distinct
 *  from the app-wide `DemoDataBadge`: that badge says the *app* is running on fixtures;
 *  this line says which specific eval run and gold-set version a given number came from,
 *  which stays meaningful even once the backend is real. */
export function EvalRunSourceLine({
  runId,
  goldSetVersion,
  className,
}: {
  runId: string;
  goldSetVersion: string;
  className?: string;
}) {
  return (
    <span className={cn("text-muted-foreground metric text-[0.65rem]", className)}>
      Source: eval run {runId} · gold set {goldSetVersion}
    </span>
  );
}
