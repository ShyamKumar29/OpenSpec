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

export function WhyPanelTrigger({
  value,
  className,
}: {
  value: AttributeValue;
  className?: string;
}) {
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
        <DialogTitle>Why: {value.attribute.name}</DialogTitle>
        {open ? <WhyPanelBody attributeValueId={value.id} /> : null}
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

  return (
    <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="flex flex-col gap-3 overflow-y-auto pr-1">
        <EvidenceSection
          value={value}
          evidence={data.evidence}
          activeEvidenceId={activeId}
          onShowOnPage={setActiveEvidenceId}
        />
        <VerificationSection verification={data.verification} />
        <ValidationSection rules={data.validation} />
        <NormalisationSection steps={data.transformChain} />
        <ConfidenceSection value={assertedValue} signals={data.confidenceSignals} />
        <PolicySection policy={data.policy} />
      </div>

      <div className="min-h-[240px] lg:min-h-0">
        {primaryEvidence ? (
          <DocumentViewer
            documentVersionId={primaryEvidence.documentVersionId}
            highlights={highlights}
            activeHighlightId={activeId}
            onActiveHighlightChange={setActiveEvidenceId}
            title={value.attribute.name}
            className="h-full"
          />
        ) : (
          <div className="border-border h-full rounded-lg border">
            <EmptyState
              icon={FileQuestion}
              title="No document evidence"
              description="This value has no evidence to show spatially — see the Evidence section for why."
              className="h-full justify-center"
            />
          </div>
        )}
      </div>
    </div>
  );
}
