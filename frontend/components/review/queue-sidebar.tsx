"use client";

import { cn } from "@/lib/utils";
import {
  REVIEW_REASON_CODES,
  type ReviewCounts,
  type ReviewReasonCode,
} from "@/lib/contracts/review";
import { REVIEW_REASON_LABEL } from "@/lib/format/review-reason";

/**
 * Reason-code tabs + counts (docs/06-frontend.md §3.3: the six
 * `[ VERIFICATION_FAILED 88 ]`-style pills). Rendered as a compact chip group at the top
 * of the Stitch review screen's "Active Tasks" rail — the filter belongs with the list it
 * filters, which is where that screen puts it.
 *
 * The total-open count and the time-remaining estimate that used to live here now sit in
 * the page header's stat cards; showing them twice on one screen was exactly the
 * duplicated information the one-viewport principle asks us to remove.
 */
export function QueueSidebar({
  counts,
  selected,
  onSelect,
  loading,
}: {
  counts: ReviewCounts | undefined;
  selected: ReviewReasonCode | "ALL";
  onSelect: (reasonCode: ReviewReasonCode | "ALL") => void;
  loading?: boolean;
}) {
  const totalOpen = counts?.totalOpen ?? 0;

  return (
    // A toggle-button group, not an ARIA tablist: selecting one filters the list shown
    // below in place rather than switching between separate tabpanels, so `aria-pressed`
    // on plain buttons is the correct pattern here, not `role="tab"`.
    <div
      role="group"
      aria-label="Review reason codes"
      data-testid="queue-sidebar"
      className="flex flex-wrap gap-1.5"
    >
      <ReasonTab
        label="All"
        count={loading ? 0 : totalOpen}
        active={selected === "ALL"}
        onClick={() => onSelect("ALL")}
      />
      {REVIEW_REASON_CODES.map((code) => (
        <ReasonTab
          key={code}
          label={REVIEW_REASON_LABEL[code]}
          count={counts?.counts[code] ?? 0}
          active={selected === code}
          onClick={() => onSelect(code)}
        />
      ))}
    </div>
  );
}

function ReasonTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      data-testid="reason-tab"
      onClick={onClick}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-sm border px-2 text-[11px] font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted",
      )}
    >
      {label}
      {/* Full-opacity, not a faded /70 — reducing opacity further below an already-muted
       *  foreground colour drops under the 4.5:1 contrast minimum (the same trap
       *  documented in components/attribute/unknown-value.tsx). */}
      <span className="metric">{count}</span>
    </button>
  );
}
