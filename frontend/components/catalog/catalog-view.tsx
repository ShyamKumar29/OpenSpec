"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PackageSearch } from "lucide-react";
import { FilterBar } from "./filter-bar";
import { RecordTable } from "./record-table";
import { CatalogExportButton } from "./export-dialog";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/shell/panel";
import { LoadingTable } from "@/components/state/loading";
import { ErrorState } from "@/components/state/error-state";
import { EmptyState } from "@/components/state/empty-state";
import { useRecordsInfiniteQuery, flattenRecordPages } from "@/lib/queries/records";
import {
  catalogFiltersToSearchParams,
  hasActiveCatalogFilters,
  parseCatalogFilters,
  type CatalogFilters,
} from "@/lib/catalog/filters";

/** The client-rendered body of `/catalog`. `page.tsx` wraps this in `<Suspense>` because
 *  `useSearchParams` opts the subtree out of static prerendering (Next.js requirement —
 *  see node_modules/next/dist/docs/.../use-search-params.md "Prerendering"). */
export function CatalogView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseCatalogFilters(searchParams), [searchParams]);

  const query = useRecordsInfiniteQuery(filters);
  const records = flattenRecordPages(query.data?.pages);

  function handleFiltersChange(next: CatalogFilters) {
    const params = catalogFiltersToSearchParams(next);
    const qs = params.toString();
    // push, not replace: back-button-correct means the browser back button undoes the
    // last filter change (docs/06-frontend.md §6 "Shareable, back-button-correct").
    // `replace` would skip straight past every catalog filter state to whatever the
    // user was on before the catalog page loaded at all.
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Two-pane workspace, per the Stitch catalog screen: a persistent "Filter Parameters"
  // rail on the left and the record table filling the rest. The split starts at `xl`
  // rather than `lg` because the seven-column record table needs the full content width
  // below 1280px; under that the rail stacks above the table rather than collapsing
  // behind a control, so the filters stay one tap away on a tablet (docs/06-frontend.md §9).
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:gap-5">
      <Panel as="aside" className="shrink-0 xl:sticky xl:top-24 xl:w-60">
        <PanelHeader title="Filter parameters" as="h2" />
        <PanelBody>
          <FilterBar filters={filters} onChange={handleFiltersChange} />
        </PanelBody>
      </Panel>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground metric text-xs">
            {records.length} record{records.length === 1 ? "" : "s"} loaded
            {query.hasNextPage ? " — more available" : ""}
          </p>
          <CatalogExportButton filters={filters} />
        </div>

        {query.status === "pending" ? (
          <LoadingTable rows={10} columns={7} />
        ) : query.status === "error" ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : records.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title={
              hasActiveCatalogFilters(filters) ? "No records match these filters" : "No records yet"
            }
            description={
              hasActiveCatalogFilters(filters)
                ? "Try widening the class, status, or completeness filter, or clear search."
                : "Import a CSV or XLSX file to populate the catalog."
            }
            action={
              hasActiveCatalogFilters(filters) ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleFiltersChange({
                      ...filters,
                      q: "",
                      classCode: null,
                      status: null,
                      completenessLt: null,
                      supplier: null,
                      hasUnknownReason: false,
                    })
                  }
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <RecordTable
              records={records}
              filters={filters}
              onFiltersChange={handleFiltersChange}
              hasNextPage={query.hasNextPage}
              isFetchingNextPage={query.isFetchingNextPage}
              fetchNextPage={() => query.fetchNextPage()}
            />
            {query.hasNextPage ? (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => query.fetchNextPage()}
                  disabled={query.isFetchingNextPage}
                >
                  {query.isFetchingNextPage ? "Loading…" : "Load more"}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
