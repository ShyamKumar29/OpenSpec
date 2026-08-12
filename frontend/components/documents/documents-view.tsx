"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileStack } from "lucide-react";
import { StatusBadge } from "@/components/attribute/status-badge";
import { LoadingTable } from "@/components/state/loading";
import { ErrorState } from "@/components/state/error-state";
import { EmptyState } from "@/components/state/empty-state";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/shell/panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDocumentsListQuery } from "@/lib/queries/documents";
import { PARSE_STATUSES } from "@/lib/contracts/document";
import { PARSE_STATUS_COPY } from "@/lib/format/parse-status";
import {
  documentFiltersToSearchParams,
  hasActiveDocumentFilters,
  parseDocumentFilters,
  type DocumentFilters,
} from "@/lib/documents/filters";

/** `/documents` — the corpus browser (docs/06-frontend.md §2; docs/14-frontend-
 *  implementation-plan.md "Additional routes": "Corpus browser, parse/binding status,
 *  bound-record count, unbound records, document health"). Shares filter-in-URL
 *  discipline with the catalog (docs/06-frontend.md §6). */
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

  const documents = query.data?.items ?? [];
  const unboundCount = documents.filter((d) => d.boundRecordCount === 0).length;

  // Same two-pane workspace as the catalog — a persistent facet rail plus the corpus
  // table (Stitch `documents` screen: "SEARCH CORPUS / PARSE HEALTH / MANUFACTURER").
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
      <Panel as="aside" className="shrink-0 lg:sticky lg:top-24 lg:w-60">
        <PanelHeader title="Corpus filters" as="h2" />
        <PanelBody className="flex flex-col gap-3">
          <div className="flex w-full flex-col gap-1">
            <label htmlFor="doc-parse-status" className="label-caps text-muted-foreground">
              Parse status
            </label>
            <Select
              value={filters.parseStatus ?? "any"}
              onValueChange={(value) =>
                handleFiltersChange({
                  ...filters,
                  parseStatus:
                    value && value !== "any" ? (value as DocumentFilters["parseStatus"]) : null,
                })
              }
            >
              <SelectTrigger id="doc-parse-status" className="w-full">
                <SelectValue>
                  {(value: string) =>
                    value === "any"
                      ? "Any"
                      : PARSE_STATUS_COPY[value as keyof typeof PARSE_STATUS_COPY].label
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                {PARSE_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {PARSE_STATUS_COPY[status].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

          {hasActiveDocumentFilters(filters) ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => handleFiltersChange({ parseStatus: null, boundCount: null })}
            >
              Clear filters
            </Button>
          ) : null}
        </PanelBody>
      </Panel>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {query.status === "success" ? (
          <p className="text-muted-foreground metric text-xs">
            {documents.length} document{documents.length === 1 ? "" : "s"}
            {unboundCount > 0 ? ` · ${unboundCount} unbound` : ""}
          </p>
        ) : null}

        {query.status === "pending" ? (
          <LoadingTable rows={8} columns={6} />
        ) : query.status === "error" ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : documents.length === 0 ? (
          <EmptyState
            icon={FileStack}
            title={
              hasActiveDocumentFilters(filters)
                ? "No documents match these filters"
                : "No documents yet"
            }
            description={
              hasActiveDocumentFilters(filters)
                ? "Try a different parse status or binding filter."
                : "Upload a spec sheet or family catalog to start binding records to evidence."
            }
            action={
              hasActiveDocumentFilters(filters) ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFiltersChange({ parseStatus: null, boundCount: null })}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="border-border bg-card overflow-x-auto rounded-sm border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground text-left">
                <tr>
                  <th className="label-caps px-3 py-2.5">Title</th>
                  <th className="label-caps px-3 py-2.5">Publisher</th>
                  <th className="label-caps px-3 py-2.5">Type</th>
                  <th className="label-caps px-3 py-2.5">Parse status</th>
                  <th className="label-caps px-3 py-2.5 text-right">Pages</th>
                  <th className="label-caps px-3 py-2.5 text-right">Bound records</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr
                    key={doc.documentVersionId}
                    data-testid="document-row"
                    className="border-border hairline hover:bg-accent/50 border-t transition-colors"
                  >
                    <td className="max-w-xs truncate px-3 py-2">
                      <Link
                        href={`/documents/${doc.documentVersionId}`}
                        className="text-foreground font-medium underline-offset-2 hover:underline"
                      >
                        {doc.title}
                      </Link>
                    </td>
                    <td className="text-muted-foreground max-w-[12rem] truncate px-3 py-2">
                      {doc.publisher}
                    </td>
                    <td className="text-muted-foreground px-3 py-2">
                      {doc.docType.replace(/_/g, " ")}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        status={PARSE_STATUS_COPY[doc.parseStatus].semantic}
                        label={PARSE_STATUS_COPY[doc.parseStatus].label}
                      />
                    </td>
                    <td className="metric px-3 py-2 text-right">{doc.pageCount}</td>
                    <td className="metric px-3 py-2 text-right">
                      {doc.boundRecordCount === 0 ? (
                        <span className="text-status-needs-review">0</span>
                      ) : (
                        doc.boundRecordCount
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
