import { cn } from "@/lib/utils";
import type { Completeness } from "@/lib/contracts/record";

/**
 * Compact accepted / pending / unknown breakdown for the catalog's "status mix" column
 * (docs/14-frontend-implementation-plan.md §6 F1). Numeral + glyph, never colour alone
 * (NFR-ACC-3) — mirrors `lib/status.ts`'s glyph choices for the equivalent
 * attribute-value states rather than inventing a fourth encoding.
 */
export function StatusMix({
  completeness,
  className,
}: {
  completeness: Completeness;
  className?: string;
}) {
  const { accepted, pendingReview, unknown } = completeness;
  return (
    <span className={cn("metric inline-flex items-center gap-2.5 text-xs", className)}>
      <span className="text-status-accepted inline-flex items-center gap-1" title="Accepted">
        <span aria-hidden="true">●</span>
        {accepted}
      </span>
      <span
        className="text-status-needs-review inline-flex items-center gap-1"
        title="Needs review or approval"
      >
        <span aria-hidden="true">◐</span>
        {pendingReview}
      </span>
      <span className="text-status-unknown inline-flex items-center gap-1" title="Unknown">
        <span aria-hidden="true">❓</span>
        {unknown}
      </span>
      <span className="sr-only">
        {accepted} accepted, {pendingReview} needing review or approval, {unknown} unknown
      </span>
    </span>
  );
}
