"use client";

/**
 * The record detail's document pane — now the real `DocumentViewer` (F2), replacing
 * F1's text-only placeholder. Resolves the record's primary binding's region (to get its
 * page/bbox — `DocumentBinding` itself carries only a `region_id`, per docs/api.md
 * §Records) and renders it as the bound row's highlight, so opening a record already
 * shows the family-table row it was matched against (demo beat 3) with no extra click.
 *
 * Responsive: an inline split view at `lg:` and above (matching the grid breakpoint
 * `RecordDetailView` itself switches at), a drawer below it — docs/06-frontend.md §9's
 * "collapsible document pane" / "document drawer" behaviour.
 */
import { FileQuestion, FileText } from "lucide-react";
import { ConfidenceIndicator } from "@/components/attribute/confidence-indicator";
import { LoadingCard } from "@/components/state/loading";
import { EmptyState } from "@/components/state/empty-state";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DocumentViewer } from "@/components/document-viewer/document-viewer";
import type { DocumentHighlight } from "@/components/document-viewer/span-highlight";
import { useDocumentQuery, useDocumentRegionsQuery } from "@/lib/queries/documents";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import type { DocumentBinding } from "@/lib/contracts/document";

export function DocumentPane({ bindings }: { bindings: DocumentBinding[] }) {
  const binding = bindings[0] ?? null;
  const document = useDocumentQuery(binding?.documentVersionId ?? null);
  const regions = useDocumentRegionsQuery(binding?.documentVersionId ?? null);
  const isWide = useMediaQuery("(min-width: 1024px)");

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

  const boundRegion = regions.data?.find((r) => r.id === binding.regionId) ?? null;
  const highlights: DocumentHighlight[] = boundRegion
    ? [
        {
          id: boundRegion.id,
          page: boundRegion.page,
          bbox: boundRegion.bbox,
          label: boundRegion.text ?? "Bound row",
          kind: "primary",
        },
      ]
    : [];

  const signalEntries = Object.entries(binding.signals);
  const otherBindings = bindings.slice(1);

  const viewer = (
    <DocumentViewer
      documentVersionId={binding.documentVersionId}
      highlights={highlights}
      activeHighlightId={boundRegion?.id ?? null}
      initialPage={boundRegion?.page}
      title={document.data?.title ?? "source document"}
      className="h-full"
    />
  );

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

      {otherBindings.length > 0 ? (
        <p className="text-status-needs-review bg-status-needs-review-bg rounded-md px-2 py-1.5 text-xs">
          ⚠ {otherBindings.length} other document version{otherBindings.length === 1 ? "" : "s"}{" "}
          also bound to this record — conflicting sources; each states a value independently.
        </p>
      ) : null}

      {isWide ? (
        <div className="min-h-[420px] flex-1">{viewer}</div>
      ) : (
        <Sheet>
          <SheetTrigger
            render={<Button variant="outline" size="sm" className="w-full justify-center gap-2" />}
          >
            <FileText className="size-4" aria-hidden="true" />
            View source document
          </SheetTrigger>
          <SheetContent side="right" className="flex w-full flex-col sm:max-w-2xl">
            <SheetHeader>
              <SheetTitle>Source document</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 px-4 pb-4">{viewer}</div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
