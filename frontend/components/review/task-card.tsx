import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";
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
 * currently focused in the queue (docs/06-frontend.md §3.3). Reuses
 * `ValueDisplay`/`ConfidenceIndicator`/`TierBadge`/`WhyPanelTrigger` rather than
 * re-rendering an `AttributeRow` — the review layout groups these fields differently
 * than the record-detail row does.
 *
 * Laid out as the Stitch review screen's comparison workspace: the source text the
 * pipeline actually read on the left, the value it proposes from it on the right, and an
 * arrow between them. That framing is not decoration — the reviewer's job is precisely to
 * judge whether the right-hand side follows from the left-hand side, and putting the two
 * side by side is what makes that judgement a glance instead of a hunt. The snippet is the
 * stored evidence verbatim (`proposedValue.evidence[].snippetText`); where a task has no
 * evidence at all, the panel says so, because that absence *is* the finding.
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
  const evidence = asserted?.evidence ?? [];

  return (
    <div data-testid="task-card" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <Link
            href={`/catalog/${task.recordId}`}
            className="text-primary text-sm font-semibold hover:underline"
          >
            {task.recordMpn}
          </Link>
          <span className="text-muted-foreground min-w-0 truncate text-xs">
            <SnippetText text={task.recordDescription} />
          </span>
        </div>
        <p className="text-muted-foreground metric shrink-0 text-xs">
          Task {position} of {total} · {REVIEW_REASON_LABEL[task.reasonCode]}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-foreground text-sm font-medium">Attribute: {task.attributeName}</span>
        <TierBadge tier={task.riskTier} />
        <WhyPanelTrigger
          attributeValueId={task.attributeValueId}
          attributeName={task.attributeName}
        />
      </div>

      {/* Source ⟶ proposal. Stacks on narrow widths; the arrow becomes a rotated glyph so
          the relationship survives the reflow. */}
      <div className="grid grid-cols-1 items-stretch gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <ComparisonSide label="Extracted source text">
          {evidence.length > 0 ? (
            <div className="flex flex-col gap-2">
              {evidence.map((e, i) => (
                <div key={`${e.regionId}-${i}`} className="flex flex-col gap-0.5">
                  <p className="metric text-foreground text-sm leading-relaxed">
                    <SnippetText text={e.snippetText} />
                  </p>
                  <p className="metric text-muted-foreground text-[11px]">
                    page {e.page} · region {e.regionId}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No evidence span is attached to this task — there is no source text to compare
              against, which is itself why it is here.
            </p>
          )}
        </ComparisonSide>

        <div className="text-muted-foreground flex items-center justify-center px-1">
          <ArrowRight className="size-4 rotate-90 md:rotate-0" aria-hidden="true" />
          <span className="sr-only">produces</span>
        </div>

        <ComparisonSide label="Proposed value">
          {asserted ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <ValueDisplay value={asserted.valueDisplay} />
              <ConfidenceIndicator
                value={asserted.confidence}
                provenance={asserted.provenanceKind}
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No proposed value — this attribute has no candidate to accept, correct, or reject; the
              only available decision is asserting <span className="metric">Unknown</span>.
            </p>
          )}
        </ComparisonSide>
      </div>

      {task.rejectionReason ? (
        // The Stitch "operational callout": a solid left rule in the status colour over a
        // tinted ground (DESIGN.md §Components — "Operational Callouts").
        <div className="border-l-status-rejected bg-status-rejected-bg/40 flex items-start gap-2 border-l-2 px-3 py-2">
          <TriangleAlert
            className="text-status-rejected mt-0.5 size-3.5 shrink-0"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="label-caps text-status-rejected">Rejected because</p>
            <p className="text-foreground mt-0.5 text-sm">
              <SnippetText text={task.rejectionReason} />
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ComparisonSide({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-border bg-muted/40 flex min-w-0 flex-col gap-1.5 rounded-sm border px-3 py-2.5">
      <span className="label-caps text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
