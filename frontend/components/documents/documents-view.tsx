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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="doc-parse-status" className="text-muted-foreground text-xs">
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
              <SelectTrigger id="doc-parse-status" className="w-44">
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

          <div className="flex flex-col gap-1">
            <label htmlFor="doc-bound-count" className="text-muted-foreground text-xs">
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
              <SelectTrigger id="doc-bound-count" className="w-40">
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
              onClick={() => handleFiltersChange({ parseStatus: null, boundCount: null })}
            >
              Clear filters
            </Button>
          ) : null}
        </div>

        {query.status === "success" ? (
          <p className="text-muted-foreground metric text-xs">
            {documents.length} document{documents.length === 1 ? "" : "s"}
            {unboundCount > 0 ? ` · ${unboundCount} unbound` : ""}
          </p>
        ) : null}
      </div>

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
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-left text-xs">
              <tr>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Publisher</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Parse status</th>
                <th className="metric px-3 py-2 text-right font-medium">Pages</th>
                <th className="metric px-3 py-2 text-right font-medium">Bound records</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr
                  key={doc.documentVersionId}
                  data-testid="document-row"
                  className="border-border hover:bg-muted/30 border-t"
                >
                  <td className="max-w-xs truncate px-3 py-2">
                    <Link
                      href={`/documents/${doc.documentVersionId}`}
                      className="text-primary hover:underline"
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
  );
}
