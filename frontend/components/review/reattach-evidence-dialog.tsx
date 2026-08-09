"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/state/loading";
import { EmptyState } from "@/components/state/empty-state";
import { DocumentViewer } from "@/components/document-viewer/document-viewer";
import type { DocumentHighlight } from "@/components/document-viewer/span-highlight";
import { useDocumentRegionsQuery } from "@/lib/queries/documents";
import { isUnknownValue } from "@/lib/contracts/attribute-value";
import type { ReviewTask } from "@/lib/contracts/review";
import { cn } from "@/lib/utils";

/**
 * `D` — reattach evidence (docs/06-frontend.md §3.3: "The proposed span came from row
 * 15, not the bound row 14" — the F5 hero task). `docs/api.md §Review` has no dedicated
 * "reattach" endpoint, so this reuses `correct` (D2: no endpoint may exist that isn't
 * documented) — the difference from a plain `E` edit is *where the new value comes
 * from*: a region the reviewer picks directly on the rendered page, not free text.
 * Reuses `DocumentViewer`'s own highlight-click selection (`SpanHighlight`'s `onSelect`)
 * rather than building a second click-to-select interaction.
 */
export function ReattachEvidenceDialog({
  open,
  onOpenChange,
  task,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: ReviewTask;
  onSubmit: (value: string, reason: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[95vw] max-w-3xl flex-col gap-3 overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Reattach evidence: {task.attributeName}</DialogTitle>
          <DialogDescription>
            Pick the correct cell on the page below — it becomes the new, `HUMAN`-provenance value
            for this attribute.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open — a fresh mount is how the region-selection state
         *  resets per task, with no reset effect required (why-panel.tsx's convention). */}
        {open ? (
          <ReattachEvidenceBody
            task={task}
            onCancel={() => onOpenChange(false)}
            onSubmit={onSubmit}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ReattachEvidenceBody({
  task,
  onCancel,
  onSubmit,
}: {
  task: ReviewTask;
  onCancel: () => void;
  onSubmit: (value: string, reason: string) => void;
}) {
  const versionId = task.documentVersionId;
  const regions = useDocumentRegionsQuery(versionId);

  const currentEvidence =
    task.proposedValue && !isUnknownValue(task.proposedValue)
      ? task.proposedValue.evidence[0]
      : null;
  const page = currentEvidence?.page ?? task.page ?? 1;

  const [selectedId, setSelectedId] = useState<string | null>(currentEvidence?.regionId ?? null);

  const candidates = useMemo(
    () => (regions.data ?? []).filter((r) => r.regionType === "cell" && r.page === page && r.text),
    [regions.data, page],
  );

  const highlights: DocumentHighlight[] = [
    ...(currentEvidence
      ? [
          {
            id: currentEvidence.regionId,
            page: currentEvidence.page,
            bbox: currentEvidence.bbox,
            label: currentEvidence.snippetText,
            kind: "primary" as const,
          },
        ]
      : []),
    ...candidates
      .filter((c) => c.id !== currentEvidence?.regionId)
      .map((c) => ({
        id: c.id,
        page: c.page,
        bbox: c.bbox,
        label: c.text!,
        kind: "candidate" as const,
      })),
  ];

  const selected = candidates.find((c) => c.id === selectedId) ?? null;
  const isUnchanged = selectedId === (currentEvidence?.regionId ?? null);

  function handleConfirm() {
    if (!selected || !selected.text) return;
    onSubmit(selected.text, `Reattached evidence to ${selected.path}`);
  }

  if (!versionId) {
    return (
      <EmptyState
        title="No source document"
        description="This task has no bound document to reattach evidence from."
      />
    );
  }
  if (regions.status === "pending") {
    return <LoadingBlock rows={6} />;
  }

  return (
    <>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden md:grid-cols-[220px_1fr]">
        <div
          className="flex flex-col gap-1 overflow-y-auto"
          role="group"
          aria-label="Candidate cells"
        >
          {candidates.length === 0 ? (
            <p className="text-muted-foreground text-xs">No labelled cells on this page.</p>
          ) : (
            candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={c.id === selectedId}
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
                  c.id === selectedId
                    ? "border-status-needs-approval bg-status-needs-approval-bg"
                    : "border-border hover:bg-muted",
                )}
              >
                <span className="metric text-muted-foreground block">
                  {c.path.split("/").slice(1).join(" · ")}
                </span>
                <span className="text-foreground font-medium">{c.text}</span>
              </button>
            ))
          )}
        </div>
        <DocumentViewer
          documentVersionId={versionId}
          highlights={highlights}
          activeHighlightId={selectedId}
          onActiveHighlightChange={setSelectedId}
          initialPage={page}
          title={task.attributeName}
          className="min-h-[280px]"
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" disabled={!selected || isUnchanged} onClick={handleConfirm}>
          Use this cell{selected ? `: ${selected.text}` : ""}
        </Button>
      </DialogFooter>
    </>
  );
}
