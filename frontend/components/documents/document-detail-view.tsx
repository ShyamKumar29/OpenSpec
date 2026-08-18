"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { usePageTitle } from "@/components/shell/page-title-context";
import { PageHeader } from "@/components/shell/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { Panel, PanelBody, PanelHeader } from "@/components/shell/panel";
import { StatusBadge } from "@/components/attribute/status-badge";
import { LoadingBlock, LoadingCard } from "@/components/state/loading";
import { ErrorState } from "@/components/state/error-state";
import { DocumentViewer } from "@/components/document-viewer/document-viewer";
import { useDocumentQuery } from "@/lib/queries/documents";
import { PARSE_STATUS_COPY } from "@/lib/format/parse-status";
import { formatConfidence } from "@/lib/format/confidence";
import type { DocumentDetail } from "@/lib/contracts/document";

/** `/documents/:id` (docs/14-frontend-implementation-plan.md "Additional routes":
 *  "Full implementation — it shares the viewer"). Metadata + the same `DocumentViewer`
 *  used on Record Detail and the Why panel, opened to page 1 with no evidence
 *  pre-highlighted — this is document browsing, not a specific attribute's proof.
 *
 *  Composed as the Stitch `document` screen: a narrow metadata rail on the left and the
 *  viewer filling the workspace beside it, rather than a full-width metadata slab pushing
 *  the page itself below the fold. Stitch's third column ("Extracted Entities") is not
 *  reproduced: `bound_record_count` is the only per-document binding signal api.md exposes
 *  (§Documents) — there is no endpoint listing *which* records or attributes a document
 *  produced — so this page reports the count in the rail rather than fabricating a list
 *  (D2: no endpoint used that isn't in api.md). */
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
          <h1 className="text-foreground font-heading text-xl leading-tight font-bold tracking-tight">
            {d.title}
          </h1>
          <StatusBadge status={parseCopy.semantic} label={parseCopy.label} />
        </div>
        <p className="text-muted-foreground metric text-[0.8125rem]">
          {d.publisher} · {d.docType.replace(/_/g, " ")} · {d.pageCount} page
          {d.pageCount === 1 ? "" : "s"}
        </p>
      </div>

      <PageContainer>
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-5">
          <DocumentMetaRail doc={d} />
          <DocumentViewer documentVersionId={documentVersionId} title={d.title} />
        </div>
      </PageContainer>
    </>
  );
}

/** The Stitch document screen's left rail: parse health, then a metadata block, then the
 *  parse-quality meter. Every row is a field the document API actually returns. */
function DocumentMetaRail({ doc: d }: { doc: DocumentDetail }) {
  return (
    <div className="flex flex-col gap-4 lg:sticky lg:top-24">
      <Panel>
        <PanelHeader title="Parse health" as="h2" />
        <PanelBody className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {d.hasTextLayer ? null : (
              <span className="text-status-rejected bg-status-rejected-bg rounded-sm px-1.5 py-0.5 text-xs">
                No text layer
              </span>
            )}
            {d.usedOcr ? (
              <span className="text-muted-foreground bg-muted rounded-sm px-1.5 py-0.5 text-xs">
                OCR used
              </span>
            ) : null}
            {d.hasTextLayer && !d.usedOcr ? (
              <span className="text-muted-foreground text-xs">
                Native text layer — no OCR needed.
              </span>
            ) : null}
          </div>

          {/* Parse quality as a labelled meter, matching the Stitch rail's confidence bar.
              The numeral is always printed beside it — the bar is reinforcement, never the
              value itself (NFR-ACC-3). */}
          <div className="flex flex-col gap-1">
            <span className="label-caps text-muted-foreground">Parse quality</span>
            {d.parseQuality === null ? (
              <span className="text-muted-foreground text-sm">Not measured</span>
            ) : (
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="bg-muted h-1.5 flex-1 rounded-full">
                  <span
                    className={
                      d.parseQuality >= 0.9
                        ? "bg-status-accepted block h-full rounded-full"
                        : "bg-status-needs-review block h-full rounded-full"
                    }
                    style={{ width: `${Math.round(d.parseQuality * 100)}%` }}
                  />
                </span>
                <span className="metric shrink-0 text-sm font-semibold">
                  {formatConfidence(d.parseQuality)}
                </span>
              </span>
            )}
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Metadata" as="h2" />
        <PanelBody>
          <dl className="flex flex-col gap-2 text-xs">
            <MetaRow label="Pages" value={<span className="metric">{d.pageCount}</span>} />
            <MetaRow
              label="Bound records"
              value={
                d.boundRecordCount === 0 ? (
                  <span className="metric text-status-needs-review">0 — unbound</span>
                ) : (
                  <span className="metric">{d.boundRecordCount}</span>
                )
              }
            />
            <MetaRow
              label="Tables · rows parsed"
              value={
                <span className="metric">
                  {d.regionsSummary.tableCount} · {d.regionsSummary.rowCount}
                </span>
              }
            />
            <MetaRow label="Fetched" value={new Date(d.fetchedAt).toLocaleDateString()} />
            <MetaRow
              label="Effective date"
              value={d.effectiveDate ? new Date(d.effectiveDate).toLocaleDateString() : "—"}
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="label-caps text-muted-foreground">Content hash</dt>
              <dd className="metric truncate" title={d.contentHash}>
                {d.contentHash}
              </dd>
            </div>
          </dl>
        </PanelBody>
      </Panel>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="label-caps text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right">{value}</dd>
    </div>
  );
}
