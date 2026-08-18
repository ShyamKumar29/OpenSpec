"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileStack, FileText, Link2, Link2Off, SearchIcon, XIcon } from "lucide-react";
import { StatusBadge } from "@/components/attribute/status-badge";
import { LoadingTable } from "@/components/state/loading";
import { ErrorState } from "@/components/state/error-state";
import { EmptyState } from "@/components/state/empty-state";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Panel, PanelBody, PanelHeader } from "@/components/shell/panel";
import { FacetList, type FacetOption } from "@/components/shell/facet-list";
import { PageHeader } from "@/components/shell/page-header";
import { PageContainer } from "@/components/shell/page-container";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDocumentsListQuery } from "@/lib/queries/documents";
import { PARSE_STATUSES, type DocumentSummary } from "@/lib/contracts/document";
import { PARSE_STATUS_COPY } from "@/lib/format/parse-status";
import { STATUS, statusBand } from "@/lib/status";
import {
  applyClientDocumentFilters,
  documentFiltersToSearchParams,
  hasActiveDocumentFilters,
  parseDocumentFilters,
  DEFAULT_DOCUMENT_FILTERS,
  type DocumentFilters,
} from "@/lib/documents/filters";
import { cn } from "@/lib/utils";

/** `/documents` — the corpus browser (docs/06-frontend.md §2; docs/14-frontend-
 *  implementation-plan.md "Additional routes": "Corpus browser, parse/binding status,
 *  bound-record count, unbound records, document health"). Shares filter-in-URL
 *  discipline with the catalog (docs/06-frontend.md §6).
 *
 *  Composed as the Stitch "Document Corpus Browser": a search + counted-facet rail on the
 *  left, and the corpus as a list of status-banded rows rather than a flat table — parse
 *  health is the thing a corpus manager scans for, so it earns the left rule and the tint
 *  instead of being one column among six. */
export function DocumentsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseDocumentFilters(searchParams), [searchParams]);

  const query = useDocumentsListQuery({
    parseStatus: filters.parseStatus ?? undefined,
    boundCount: filters.boundCount ?? undefined,
  });

  function handleFiltersChange(next: DocumentFilters) {
    const params = documentFiltersToSearchParams(next);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const serverFiltered = useMemo(() => query.data?.items ?? [], [query.data]);
  const documents = useMemo(
    () => applyClientDocumentFilters(serverFiltered, filters),
    [serverFiltered, filters],
  );
  const unboundCount = documents.filter((d) => d.boundRecordCount === 0).length;
  const active = hasActiveDocumentFilters(filters);

  // Facet counts are computed from the page the server actually returned, and only the
  // *other* client refinement is applied first — so ticking one publisher does not zero
  // out every other publisher's count, which is what makes a facet list usable.
  const publisherOptions: FacetOption[] = useMemo(() => {
    const scope = serverFiltered.filter((doc) =>
      filters.q.trim()
        ? applyClientDocumentFilters([doc], { ...filters, publishers: [] }).length > 0
        : true,
    );
    const counts = new Map<string, number>();
    for (const doc of scope) counts.set(doc.publisher, (counts.get(doc.publisher) ?? 0) + 1);
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [serverFiltered, filters]);

  const description =
    query.status === "success"
      ? `${documents.length} document${documents.length === 1 ? "" : "s"}` +
        (unboundCount > 0 ? ` · ${unboundCount} unbound` : "")
      : "Manage, filter, and review ingested specification documents.";

  return (
    <>
      <PageHeader title="Document corpus" description={description} />
      <PageContainer>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
          <Panel as="aside" className="shrink-0 lg:sticky lg:top-24 lg:w-64">
            <PanelHeader
              title="Corpus filters"
              as="h2"
              actions={
                active ? (
                  <Button
                    variant="link"
                    size="xs"
                    className="text-muted-foreground h-auto px-0 py-0 text-xs"
                    onClick={() => handleFiltersChange(DEFAULT_DOCUMENT_FILTERS)}
                  >
                    Reset
                  </Button>
                ) : null
              }
            />
            <PanelBody className="flex flex-col gap-4">
              <CorpusSearch filters={filters} onChange={handleFiltersChange} />

              <ParseHealthFacet
                documents={serverFiltered}
                filters={filters}
                onChange={handleFiltersChange}
              />

              <div className="flex w-full flex-col gap-1">
                <label htmlFor="doc-bound-count" className="label-caps text-muted-foreground">
                  Binding
                </label>
                <Select
                  value={filters.boundCount ?? "any"}
                  onValueChange={(value) =>
                    handleFiltersChange({
                      ...filters,
                      boundCount: value === "0" || value === "gt0" ? value : null,
                    })
                  }
                >
                  <SelectTrigger id="doc-bound-count" className="w-full">
                    <SelectValue>
                      {(value: string) =>
                        value === "any" ? "Any" : value === "0" ? "Unbound" : "Has bound records"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="gt0">Has bound records</SelectItem>
                    <SelectItem value="0">Unbound</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {publisherOptions.length > 1 ? (
                <FacetList
                  legend="Publisher"
                  options={publisherOptions}
                  selected={filters.publishers}
                  onChange={(publishers) => handleFiltersChange({ ...filters, publishers })}
                  initialVisible={5}
                />
              ) : null}
            </PanelBody>
          </Panel>

          <div className="min-w-0 flex-1">
            {query.status === "pending" ? (
              <LoadingTable rows={8} columns={6} />
            ) : query.status === "error" ? (
              <ErrorState error={query.error} onRetry={() => query.refetch()} />
            ) : documents.length === 0 ? (
              <EmptyState
                icon={FileStack}
                title={active ? "No documents match these filters" : "No documents yet"}
                description={
                  active
                    ? "Try a different parse status, publisher, or binding filter, or clear the search."
                    : "Upload a spec sheet or family catalog to start binding records to evidence."
                }
                action={
                  active ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleFiltersChange(DEFAULT_DOCUMENT_FILTERS)}
                    >
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <DocumentList documents={documents} />
            )}
          </div>
        </div>
      </PageContainer>
    </>
  );
}

/** The Stitch "SEARCH CORPUS" field. Debounced into the URL on the same 300ms cadence as
 *  the catalog's search so the two lists behave identically. */
function CorpusSearch({
  filters,
  onChange,
}: {
  filters: DocumentFilters;
  onChange: (next: DocumentFilters) => void;
}) {
  const [q, setQ] = useState(filters.q);

  // Re-sync when the URL changes from outside this field (Reset, back/forward). Adjusted
  // during render rather than in an effect — React's sanctioned "reset state on prop
  // change" pattern, and the same one `FilterBar` uses.
  const [prevQ, setPrevQ] = useState(filters.q);
  if (filters.q !== prevQ) {
    setPrevQ(filters.q);
    setQ(filters.q);
  }

  useEffect(() => {
    if (q === filters.q) return;
    const timeout = setTimeout(() => onChange({ ...filters, q }), 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex w-full flex-col gap-1">
      <label htmlFor="doc-search" className="label-caps text-muted-foreground">
        Search corpus
      </label>
      <InputGroup className="w-full">
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          id="doc-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="File name, publisher…"
        />
        {q ? (
          <InputGroupAddon align="inline-end">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Clear search"
              onClick={() => setQ("")}
            >
              <XIcon />
            </Button>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
    </div>
  );
}

/**
 * Parse health as a counted facet, the way Stitch draws it. The underlying filter is
 * single-valued (`GET /documents?parse_status=`), so this is a radio-shaped facet
 * rendered in the list's visual form — ticking one replaces the selection rather than
 * adding to it, and ticking the selected one clears it.
 *
 * Counts come from an unfiltered fetch of the corpus, not from the filtered page: a facet
 * that reads "Unparseable (0)" the moment you select "Parsed" tells you nothing.
 */
function ParseHealthFacet({
  documents,
  filters,
  onChange,
}: {
  documents: readonly DocumentSummary[];
  filters: DocumentFilters;
  onChange: (next: DocumentFilters) => void;
}) {
  const all = useDocumentsListQuery({});
  const scope = all.data?.items ?? documents;

  const options: FacetOption[] = PARSE_STATUSES.map((status) => ({
    value: status,
    label: PARSE_STATUS_COPY[status].label,
    count: scope.filter((d) => d.parseStatus === status).length,
    dotClassName: STATUS[PARSE_STATUS_COPY[status].semantic].rule,
  })).filter((option) => option.count > 0 || filters.parseStatus === option.value);

  return (
    <FacetList
      legend="Parse health"
      options={options}
      selected={filters.parseStatus ? [filters.parseStatus] : []}
      onChange={(next) => {
        const picked = next.find((v) => v !== filters.parseStatus) ?? null;
        onChange({ ...filters, parseStatus: picked as DocumentFilters["parseStatus"] });
      }}
      initialVisible={PARSE_STATUSES.length}
    />
  );
}

/** The corpus as banded rows — the Stitch corpus browser's list body. */
function DocumentList({ documents }: { documents: DocumentSummary[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* Column captions, aligned to the row grid below. Hidden on small screens where
          the rows collapse to a stacked card. */}
      <div
        aria-hidden="true"
        className="text-muted-foreground hidden items-center gap-3 px-3 lg:flex"
      >
        <span className="label-caps min-w-0 flex-1">Document &amp; publisher</span>
        <span className="label-caps w-28 shrink-0">Version date</span>
        <span className="label-caps w-24 shrink-0 text-right">Bindings</span>
        <span className="label-caps w-40 shrink-0">Parse health</span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {documents.map((doc) => {
          const copy = PARSE_STATUS_COPY[doc.parseStatus];
          const attention = copy.semantic !== "accepted";
          return (
            <li key={doc.documentVersionId}>
              <div
                data-testid="document-row"
                className={cn(
                  "border-border bg-card hover:bg-accent/40 flex flex-col gap-2 rounded-sm border px-3 py-2.5 transition-colors lg:flex-row lg:items-center lg:gap-3",
                  statusBand(copy.semantic, attention),
                )}
              >
                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                  <FileText
                    className="text-muted-foreground mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <Link
                      href={`/documents/${doc.documentVersionId}`}
                      className="text-foreground focus-visible:ring-ring/50 block truncate text-sm font-medium underline-offset-2 hover:underline focus-visible:ring-3 focus-visible:outline-none"
                    >
                      {doc.title}
                    </Link>
                    <p className="text-muted-foreground truncate text-xs">
                      {doc.publisher} · {doc.docType.replace(/_/g, " ")} · {doc.pageCount} page
                      {doc.pageCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                <span className="metric text-muted-foreground w-28 shrink-0 text-xs">
                  {doc.firstSeenAt.slice(0, 10)}
                </span>

                <span className="flex w-24 shrink-0 items-center justify-end gap-1.5">
                  <span
                    className={cn(
                      "metric border-border rounded-sm border px-1.5 py-0.5 text-xs font-semibold",
                      doc.boundRecordCount === 0
                        ? "text-status-needs-review bg-status-needs-review-bg"
                        : "bg-muted",
                    )}
                  >
                    {doc.boundRecordCount}
                  </span>
                  {doc.boundRecordCount === 0 ? (
                    <Link2Off
                      role="img"
                      aria-label="No records bound"
                      className="text-status-needs-review size-3.5"
                    />
                  ) : (
                    <Link2
                      role="img"
                      aria-label="Records bound"
                      className="text-muted-foreground size-3.5"
                    />
                  )}
                </span>

                <span className="w-40 shrink-0">
                  <StatusBadge status={copy.semantic} label={copy.label} />
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
