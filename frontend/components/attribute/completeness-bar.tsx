import { cn } from "@/lib/utils";
import type { Completeness } from "@/lib/contracts/record";

/**
 * Segmented completeness bar — accepted / pending (review + approval) / unknown, out of
 * `mandatoryTotal`. Shared by the catalog table and the Record Detail header so the two
 * pages never reconcile two different renderings of the same numbers (risk F-3).
 * Colour is never the only signal (NFR-ACC-3): the numeral label and an `aria-label`
 * carry the same information as text.
 */
export function CompletenessBar({
  completeness,
  className,
}: {
  completeness: Completeness;
  className?: string;
}) {
  const { mandatoryTotal, filled, accepted, pendingReview, unknown } = completeness;
  const pct = (n: number) => (mandatoryTotal === 0 ? 0 : (n / mandatoryTotal) * 100);

  return (
    <div className={cn("flex min-w-28 items-center gap-2", className)}>
      <div
        className="bg-status-unknown-bg h-2 flex-1 overflow-hidden rounded-full"
        role="img"
        aria-label={`Completeness: ${accepted} accepted, ${pendingReview} pending review or approval, ${unknown} unknown, of ${mandatoryTotal} mandatory attributes.`}
      >
        <div className="flex h-full">
          <span
            className="bg-status-accepted h-full first:rounded-l-full"
            style={{ width: `${pct(accepted)}%` }}
          />
          <span
            className="bg-status-needs-review h-full"
            style={{ width: `${pct(pendingReview)}%` }}
          />
        </div>
      </div>
      <span className="metric text-muted-foreground shrink-0 text-xs">
        {filled}/{mandatoryTotal}
      </span>
    </div>
  );
}
