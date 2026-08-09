import Link from "next/link";
import { TierBadge } from "@/components/attribute/tier-badge";
import { ValueDisplay } from "@/components/attribute/value-display";
import { ConfidenceIndicator } from "@/components/attribute/confidence-indicator";
import { SnippetText } from "@/components/attribute/snippet-text";
import { WhyPanelTrigger } from "@/components/why-panel/why-panel";
import { isUnknownValue } from "@/lib/contracts/attribute-value";
import type { ReviewTask } from "@/lib/contracts/review";
import { REVIEW_REASON_LABEL } from "@/lib/format/review-reason";

/**
 * The proposed value, its rejection reason, and full provenance context for the task
 * currently focused in the queue (docs/06-frontend.md §3.3, left column). Reuses
 * `ValueDisplay`/`ConfidenceIndicator`/`TierBadge`/`WhyPanelTrigger` rather than
 * re-rendering an `AttributeRow` — the review layout groups these fields differently
 * (proposed value + rejection reason side by side) than the record-detail row does.
 */
export function TaskCard({
  task,
  position,
  total,
}: {
  task: ReviewTask;
  position: number;
  total: number;
}) {
  const asserted =
    task.proposedValue && !isUnknownValue(task.proposedValue) ? task.proposedValue : null;

  return (
    <div data-testid="task-card" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-muted-foreground metric text-xs">
          Task {position} of {total} · {REVIEW_REASON_LABEL[task.reasonCode]}
        </p>
      </div>

      <div>
        <Link
          href={`/catalog/${task.recordId}`}
          className="text-primary text-sm font-medium hover:underline"
        >
          {task.recordMpn}
        </Link>
        <p className="text-muted-foreground truncate text-xs">
          <SnippetText text={task.recordDescription} />
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-foreground text-sm font-medium">Attribute: {task.attributeName}</span>
        <TierBadge tier={task.riskTier} />
        <WhyPanelTrigger
          attributeValueId={task.attributeValueId}
          attributeName={task.attributeName}
        />
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Proposed
        </p>
        {asserted ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <ValueDisplay value={asserted.valueDisplay} />
            <ConfidenceIndicator value={asserted.confidence} provenance={asserted.provenanceKind} />
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No proposed value — this attribute has no candidate to accept, correct, or reject; the
            only available decision is asserting <span className="metric">Unknown</span>.
          </p>
        )}
      </div>

      {task.rejectionReason ? (
        <div className="flex flex-col gap-1">
          <p className="text-status-rejected text-xs font-medium tracking-wide uppercase">
            Rejected because
          </p>
          <p className="text-muted-foreground text-sm">
            <SnippetText text={task.rejectionReason} />
          </p>
        </div>
      ) : null}
    </div>
  );
}
