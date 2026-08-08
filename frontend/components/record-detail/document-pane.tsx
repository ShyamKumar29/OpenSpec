"use client";

/**
 * Document pane placeholder — reserved for F2 (docs/14-frontend-implementation-plan.md
 * §6 F1: "document pane placeholder reserved for F2"). Renders the real binding data
 * already on `RecordDetail` (document, region, binding confidence, match signals) as
 * text, never a rendered page or a highlight — that's `DocumentViewer`. Saying so
 * explicitly keeps this from being mistaken for the finished component.
 */
import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { ConfidenceIndicator } from "@/components/attribute/confidence-indicator";
import { LoadingCard } from "@/components/state/loading";
import { EmptyState } from "@/components/state/empty-state";
import { useDocumentQuery } from "@/lib/queries/documents";
import type { DocumentBinding } from "@/lib/contracts/document";

export function DocumentPane({ bindings }: { bindings: DocumentBinding[] }) {
  const binding = bindings[0] ?? null;
  const document = useDocumentQuery(binding?.documentVersionId ?? null);

  if (!binding) {
    return (
      <div className="border-border rounded-lg border p-4">
        <EmptyState
          icon={FileQuestion}
          title="No document bound"
          description="Attribute values on this record without a citation return Unknown(NO_DOCUMENT_FOUND)."
        />
      </div>
    );
  }

  const signalEntries = Object.entries(binding.signals);

  return (
    <div className="border-border flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-foreground text-sm font-semibold">Source document</h2>

      {document.isLoading ? (
        <LoadingCard />
      ) : document.data ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-muted-foreground">Title</dt>
          <dd className="truncate">{document.data.title}</dd>
          <dt className="text-muted-foreground">Publisher</dt>
          <dd className="truncate">{document.data.publisher}</dd>
          <dt className="text-muted-foreground">Bound region</dt>
          <dd className="metric truncate">{binding.regionId ?? "—"}</dd>
          <dt className="text-muted-foreground">Binding confidence</dt>
          <dd>
            <ConfidenceIndicator value={binding.confidence} />
          </dd>
          {signalEntries.length > 0 ? (
            <>
              <dt className="text-muted-foreground self-start">Match signals</dt>
              <dd className="flex flex-wrap gap-x-3 gap-y-1">
                {signalEntries.map(([key, val]) => (
                  <span key={key} className="metric">
                    {key}: {String(val)}
                  </span>
                ))}
              </dd>
            </>
          ) : null}
        </dl>
      ) : (
        <p className="text-muted-foreground text-xs">Document metadata unavailable.</p>
      )}

      <Link
        href={`/documents/${binding.documentVersionId}`}
        className="text-primary text-sm underline-offset-2 hover:underline"
      >
        Open in document corpus →
      </Link>

      <p className="text-muted-foreground border-border border-t pt-3 text-xs">
        The rendered page with the highlighted evidence span arrives with the document viewer. Each
        attribute&apos;s <span className="font-medium">[why?]</span> popover already shows its
        verbatim citation.
      </p>
    </div>
  );
}
