"use client";

import { cn } from "@/lib/utils";
import {
  REVIEW_REASON_CODES,
  type ReviewCounts,
  type ReviewReasonCode,
} from "@/lib/contracts/review";
import { REVIEW_REASON_LABEL } from "@/lib/format/review-reason";

/**
 * Reason-code tabs + counts, total open, and time remaining at the current rate
 * (docs/06-frontend.md §3.3: "412 open · ~2.4 h remaining at current rate" plus the six
 * `[ VERIFICATION_FAILED 88 ]`-style pills). Rendered as a horizontal strip, matching the
 * wireframe's actual layout rather than the component-hierarchy name's literal
 * "sidebar" (docs/06-frontend.md §4 names it `QueueSidebar`; §3.3 draws it as a top row).
 */
export function QueueSidebar({
  counts,
  selected,
  onSelect,
  etaHours,
  loading,
}: {
  counts: ReviewCounts | undefined;
  selected: ReviewReasonCode | "ALL";
  onSelect: (reasonCode: ReviewReasonCode | "ALL") => void;
  /** Hours remaining at the reviewer's current measured rate — `null` when there's not
   *  yet enough session data (or the queue is empty) to estimate one. */
  etaHours: number | null;
  loading?: boolean;
}) {
  const totalOpen = counts?.totalOpen ?? 0;

  return (
    <div className="flex flex-col gap-2" data-testid="queue-sidebar">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-foreground text-sm font-medium">
          <span className="metric">{loading ? "…" : totalOpen}</span> open
          {etaHours !== null ? (
            <span className="text-muted-foreground metric font-normal">
              {" "}
              · ~{etaHours < 1 ? "<1" : etaHours.toFixed(1)} h remaining at current rate
            </span>
          ) : null}
        </p>
      </div>

      {/* A toggle-button group, not an ARIA tablist: selecting one filters the list shown
       *  below in place rather than switching between separate tabpanels, so
       *  `aria-pressed` on plain buttons is the correct pattern here, not `role="tab"`. */}
      <div role="group" aria-label="Review reason codes" className="flex flex-wrap gap-1.5">
        <ReasonTab
          label="All"
          count={totalOpen}
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
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
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
