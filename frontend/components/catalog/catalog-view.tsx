"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PackageSearch } from "lucide-react";
import { FilterBar } from "./filter-bar";
import { RecordTable } from "./record-table";
import { CatalogExportButton } from "./export-dialog";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/shell/panel";
import { PageHeader } from "@/components/shell/page-header";
import { PageContainer } from "@/components/shell/page-container";
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

  function clearFilters() {
    handleFiltersChange({
      ...filters,
      q: "",
      classCode: null,
      status: null,
      completenessLt: null,
      supplier: null,
      hasUnknownReason: false,
    });
  }

  const active = hasActiveCatalogFilters(filters);

  // The Stitch catalog header states the size of the result set directly under the title
  // ("14,203 Records · 89% Validation Rate"). The equivalent true statement here is what
  // the cursor-paginated query can actually vouch for — how many records are loaded, and
  // whether more remain. Inventing a total the API does not return would be the exact
  // class of unsourced number this product exists to refuse.
  const description =
    query.status === "success"
      ? `${records.length}${query.hasNextPage ? "+" : ""} record${records.length === 1 ? "" : "s"} loaded` +
        (active ? " · filtered" : "")
      : "Searchable, filterable record list.";

  return (
    <>
      <PageHeader
        title="Catalog"
        description={description}
        actions={<CatalogExportButton filters={filters} />}
      />
      <PageContainer>
        {/* Two-pane workspace, per the Stitch catalog screen: a persistent "Filter
            Parameters" rail on the left and the record table filling the rest. The split
            starts at `xl` rather than `lg` because the seven-column record table needs the
            full content width below 1280px; under that the rail stacks above the table
            rather than collapsing behind a control, so the filters stay one tap away on a
            tablet (docs/06-frontend.md §9). */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:gap-5">
          <Panel as="aside" className="shrink-0 xl:sticky xl:top-24 xl:w-64">
            <PanelHeader
              title="Filter parameters"
              as="h2"
              actions={
                active ? (
                  <Button
                    variant="link"
                    size="xs"
                    className="text-muted-foreground h-auto px-0 py-0 text-xs"
                    onClick={clearFilters}
                  >
                    Reset
                  </Button>
                ) : null
              }
            />
            <PanelBody>
              <FilterBar filters={filters} onChange={handleFiltersChange} />
            </PanelBody>
          </Panel>

          <div className="min-w-0 flex-1">
            {query.status === "pending" ? (
              <LoadingTable rows={10} columns={7} />
            ) : query.status === "error" ? (
              <ErrorState error={query.error} onRetry={() => query.refetch()} />
            ) : records.length === 0 ? (
              <EmptyState
                icon={PackageSearch}
                title={active ? "No records match these filters" : "No records yet"}
                description={
                  active
                    ? "Try widening the class, status, or completeness filter, or clear search."
                    : "Import a CSV or XLSX file to populate the catalog."
                }
                action={
                  active ? (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <RecordTable
                records={records}
                filters={filters}
                onFiltersChange={handleFiltersChange}
                hasNextPage={query.hasNextPage}
                isFetchingNextPage={query.isFetchingNextPage}
                fetchNextPage={() => query.fetchNextPage()}
              />
            )}
          </div>
        </div>
      </PageContainer>
    </>
  );
}
