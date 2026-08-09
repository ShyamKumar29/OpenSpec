"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { usePageTitle } from "@/components/shell/page-title-context";
import { PageHeader } from "@/components/shell/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { StatusBadge } from "@/components/attribute/status-badge";
import { LoadingBlock, LoadingCard } from "@/components/state/loading";
import { ErrorState } from "@/components/state/error-state";
import { DocumentViewer } from "@/components/document-viewer/document-viewer";
import { useDocumentQuery } from "@/lib/queries/documents";
import { PARSE_STATUS_COPY } from "@/lib/format/parse-status";
import { formatConfidence } from "@/lib/format/confidence";

/** `/documents/:id` (docs/14-frontend-implementation-plan.md "Additional routes":
 *  "Full implementation — it shares the viewer"). Metadata + the same `DocumentViewer`
 *  used on Record Detail and the Why panel, opened to page 1 with no evidence
 *  pre-highlighted — this is document browsing, not a specific attribute's proof.
 *
 *  `bound_record_count` is the only per-document binding signal `api.md` exposes
 *  (§Documents) — there is no endpoint to list *which* records are bound to a document,
 *  so this page reports the count rather than fabricating a list (D2: no endpoint used
 *  that isn't in api.md). */
export function DocumentDetailView({ documentVersionId }: { documentVersionId: string }) {
  const doc = useDocumentQuery(documentVersionId);
  usePageTitle(doc.data ? doc.data.title : null);

  if (doc.status === "pending") {
    return (
      <>
        <PageHeader title="Document" description="Loading…" />
        <PageContainer>
          <LoadingCard />
          <div className="mt-4">
            <LoadingBlock rows={6} />
          </div>
        </PageContainer>
      </>
    );
  }
  if (doc.status === "error") {
    return (
      <>
        <PageHeader title="Document" />
        <PageContainer>
          <ErrorState error={doc.error} onRetry={() => doc.refetch()} />
        </PageContainer>
      </>
    );
  }

  const d = doc.data;
  const parseCopy = PARSE_STATUS_COPY[d.parseStatus];

  return (
    <>
      <div className="border-border flex flex-col gap-2 border-b px-4 py-4 sm:px-6">
        <Link
          href="/documents"
          className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm"
        >
          <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
          Documents
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-foreground text-lg font-semibold tracking-tight">{d.title}</h1>
          <StatusBadge status={parseCopy.semantic} label={parseCopy.label} />
        </div>
        <p className="text-muted-foreground text-sm">{d.publisher}</p>
      </div>

      <PageContainer>
        <div className="flex flex-col gap-4">
          <div className="border-border rounded-lg border p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              {d.hasTextLayer ? null : <span className="text-status-rejected">no text layer</span>}
              {d.usedOcr ? <span className="text-muted-foreground">OCR used</span> : null}
            </div>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-muted-foreground">Type</dt>
                <dd>{d.docType.replace(/_/g, " ")}</dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-muted-foreground">Pages</dt>
                <dd className="metric">{d.pageCount}</dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-muted-foreground">Bound records</dt>
                <dd className="metric">
                  {d.boundRecordCount === 0 ? (
                    <span className="text-status-needs-review">0 (unbound)</span>
                  ) : (
                    d.boundRecordCount
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-muted-foreground">Tables · rows parsed</dt>
                <dd className="metric">
                  {d.regionsSummary.tableCount} · {d.regionsSummary.rowCount}
                </dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-muted-foreground">Parse quality</dt>
                <dd className="metric">
                  {d.parseQuality === null ? "—" : formatConfidence(d.parseQuality)}
                </dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-muted-foreground">Fetched</dt>
                <dd>{new Date(d.fetchedAt).toLocaleDateString()}</dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-muted-foreground">Effective date</dt>
                <dd>{d.effectiveDate ? new Date(d.effectiveDate).toLocaleDateString() : "—"}</dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-muted-foreground">Content hash</dt>
                <dd className="metric truncate" title={d.contentHash}>
                  {d.contentHash}
                </dd>
              </div>
            </dl>
          </div>

          <DocumentViewer documentVersionId={documentVersionId} title={d.title} />
        </div>
      </PageContainer>
    </>
  );
}
