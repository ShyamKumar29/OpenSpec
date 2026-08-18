"use client";

/**
 * The Why panel (docs/06-frontend.md §3.2) — "the product in one screen", reachable in
 * one click from any attribute row. Consumes `GET /attributes/{id}/explain`
 * (`useAttributeExplainQuery`), NOT the record's own already-fetched `AttributeValue` —
 * `explain` is the payload documented to carry validation, the normalisation chain, and
 * the confidence signal vector (docs/14-frontend-implementation-plan.md §6 F3). This
 * replaces F1's `EvidencePopover`, which rendered only what the core DTO already
 * carried (evidence + verification) as a citation, not the full panel.
 *
 * The embedded `DocumentViewer` is what makes "attribute → Why → evidence → exact
 * document location → highlighted source" a single interaction (docs/06-frontend.md §1
 * Thesis 1) — no navigation away from the panel is needed to see the pixels.
 */
import { useState } from "react";
import { FileQuestion } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/state/loading";
import { ErrorState } from "@/components/state/error-state";
import { EmptyState } from "@/components/state/empty-state";
import { DocumentViewer } from "@/components/document-viewer/document-viewer";
import type { DocumentHighlight } from "@/components/document-viewer/span-highlight";
import { useAttributeExplainQuery } from "@/lib/queries/attributes";
import type { AttributeValue } from "@/lib/contracts/attribute-value";
import {
  ConfidenceSection,
  EvidenceSection,
  NormalisationSection,
  PolicySection,
  ValidationSection,
  VerificationSection,
} from "./why-panel-sections";

export type WhyPanelTriggerProps =
  | {
      value: AttributeValue;
      attributeValueId?: undefined;
      attributeName?: undefined;
      className?: string;
    }
  | { value?: undefined; attributeValueId: string; attributeName: string; className?: string };

/**
 * Accepts either an already-fetched `AttributeValue` (Record Detail, Judge Mode) or a
 * bare `attributeValueId` + `attributeName` (the Review Queue: a task whose proposed
 * value is `null` — e.g. NO_DOCUMENT/AMBIGUOUS/CONFLICTING — still has an underlying
 * `attribute_value` row worth explaining, but the review task DTO doesn't carry a full
 * `AttributeValue` for it). Both forms open the identical `WhyPanelBody` — one component,
 * one query, no duplicated evidence-rendering logic per phase.
 */
export function WhyPanelTrigger(props: WhyPanelTriggerProps) {
  const { className } = props;
  const attributeValueId = props.value ? props.value.id : props.attributeValueId;
  const attributeName = props.value ? props.value.attribute.name : props.attributeName;
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="link"
            size="xs"
            className={
              className ??
              "text-muted-foreground hover:text-foreground h-auto px-0 text-xs font-normal"
            }
          />
        }
      >
        [why?]
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-4xl flex-col gap-3 overflow-hidden p-4 sm:max-w-4xl">
        <DialogTitle>Why: {attributeName}</DialogTitle>
        {open ? <WhyPanelBody attributeValueId={attributeValueId} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function WhyPanelBody({ attributeValueId }: { attributeValueId: string }) {
  const explain = useAttributeExplainQuery(attributeValueId);
  const [activeEvidenceId, setActiveEvidenceId] = useState<string | null>(null);

  if (explain.status === "pending") {
    return <LoadingBlock rows={8} />;
  }
  if (explain.status === "error") {
    return <ErrorState error={explain.error} onRetry={() => explain.refetch()} />;
  }

  const data = explain.data;
  const value = data.attributeValue;
  const assertedValue = value.status === "UNKNOWN" ? null : value;

  const highlights: DocumentHighlight[] = data.evidence.map((e, i) => ({
    id: e.regionId,
    page: e.page,
    bbox: e.bbox,
    label: e.snippetText,
    kind: i === 0 ? "primary" : "candidate",
  }));
  const activeId = activeEvidenceId ?? highlights[0]?.id ?? null;
  const primaryEvidence = data.evidence[0] ?? null;

  // Composed as the Stitch "Attribute Insight" screen: the final value stated once at the
  // top, the derivation that produced it as a numbered spine on the left, and the proof —
  // document snippet, confidence breakdown, governing policy — stacked on the right. The
  // sections themselves are unchanged; what moved is that Confidence and Policy now sit
  // beside the evidence they qualify rather than at the bottom of a six-item scroll.
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="border-border bg-muted/40 flex flex-wrap items-end justify-between gap-3 rounded-sm border px-3 py-2.5">
        <div className="min-w-0">
          <p className="label-caps text-muted-foreground">Attribute</p>
          <p className="text-foreground text-sm font-medium">{value.attribute.name}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="label-caps text-muted-foreground">
            {assertedValue ? "Final normalised value" : "Outcome"}
          </p>
          {assertedValue ? (
            <p className="metric text-foreground text-xl leading-tight font-bold">
              {assertedValue.valueDisplay}
            </p>
          ) : (
            // Just the word, not the full `UnknownValue`. The reason code and its
            // remediation are the Evidence step's whole content immediately below; repeating
            // them here would state the same finding twice on one screen.
            <p className="metric text-status-unknown text-xl leading-tight font-bold">Unknown</p>
          )}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-1 overflow-y-auto pr-1 pl-3">
          <p className="label-caps text-muted-foreground mb-1">Extraction reasoning</p>
          <EvidenceSection
            value={value}
            evidence={data.evidence}
            activeEvidenceId={activeId}
            onShowOnPage={setActiveEvidenceId}
          />
          <VerificationSection verification={data.verification} />
          <ValidationSection rules={data.validation} />
          <NormalisationSection steps={data.transformChain} />
        </div>

        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <div className="min-h-[240px] shrink-0">
            {primaryEvidence ? (
              <DocumentViewer
                documentVersionId={primaryEvidence.documentVersionId}
                highlights={highlights}
                activeHighlightId={activeId}
                onActiveHighlightChange={setActiveEvidenceId}
                title={value.attribute.name}
              />
            ) : (
              <div className="border-border h-full rounded-sm border">
                <EmptyState
                  icon={FileQuestion}
                  title="No document evidence"
                  description="This value has no evidence to show spatially — see the Evidence section for why."
                  className="h-full justify-center"
                />
              </div>
            )}
          </div>

          <div className="border-border shrink-0 rounded-sm border px-3 py-2.5">
            <ConfidenceSection value={assertedValue} signals={data.confidenceSignals} />
          </div>
          <div className="border-border shrink-0 rounded-sm border px-3 py-2.5">
            <PolicySection policy={data.policy} />
          </div>
        </div>
      </div>
    </div>
  );
}
