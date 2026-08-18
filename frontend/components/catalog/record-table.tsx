"use client";

/**
 * Virtualised record list (TanStack Virtual, docs/14-frontend-implementation-plan.md
 * §6 F1). Rendered as an ARIA grid over `div`s rather than a native `<table>` — a real
 * table can't absolutely-position virtualised rows without breaking column alignment,
 * and the window-virtualizer pattern (the list scrolls with the page, not an inner
 * fixed-height pane) needs the page's own scroll container. `role="table"`/`row`/
 * `columnheader`/`cell` restores the semantics a screen reader needs (NFR-ACC).
 */
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronUp, ChevronsUpDown, FileWarning, FileCheck } from "lucide-react";
import { CompletenessBar } from "@/components/attribute/completeness-bar";
import { ConfidenceIndicator } from "@/components/attribute/confidence-indicator";
import { RecordStatusBadge } from "./record-status-badge";
import { StatusMix } from "./status-mix";
import { Button } from "@/components/ui/button";
import { sortDirection, sortField, toggleSort, type CatalogFilters } from "@/lib/catalog/filters";
import type { RecordSummary } from "@/lib/contracts/record";
import { RECORD_STATUS_SEMANTIC } from "@/lib/format/record-status";
import { statusBand } from "@/lib/status";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 56;

/** Record states that earn the Stitch "banded row" treatment — a left rule and a faint
 *  tint marking the row as needing someone's attention while scrolling. `healthy` and
 *  `partially_enriched` are working as intended and stay unbanded; banding everything
 *  would say nothing. */
const BANDED_STATUSES = new Set([
  "class_unresolved",
  "unbound",
  "conflicting_sources",
  "unknown_heavy",
  "awaiting_tier0_approval",
]);

const COLUMNS: {
  key: "mpn_raw" | "completeness" | "unknown_count" | "tier0_pending_count" | null;
  label: string;
  className: string;
}[] = [
  // Columns drop out as the viewport narrows, rather than the table being clipped or the
  // page being pushed into horizontal scroll. The order they leave in is the reverse of
  // how much a data manager needs them: the MPN and the Unknown count survive to the
  // narrowest width, the redundant status-mix re-encoding of completeness goes first.
  //
  // The visibility class must be `hidden …:block`, not `…:flex` — the cells are block
  // elements inside a flex row, and the same `className` styles both the header cell and
  // the body cell so the two can never disagree about which columns exist.
  { key: "mpn_raw", label: "MPN / description", className: "min-w-56 flex-[3]" },
  { key: null, label: "Class", className: "hidden min-w-36 flex-[2] lg:block" },
  { key: "completeness", label: "Completeness", className: "hidden min-w-36 flex-[2] sm:block" },
  { key: null, label: "Status mix", className: "hidden min-w-32 flex-[2] xl:block" },
  {
    key: "tier0_pending_count",
    label: "Tier-0",
    className: "hidden w-24 shrink-0 text-right md:block",
  },
  { key: "unknown_count", label: "Unknown", className: "w-20 shrink-0 text-right" },
  { key: null, label: "Doc", className: "hidden w-16 shrink-0 sm:block" },
];

export function RecordTable({
  records,
  filters,
  onFiltersChange,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: {
  records: RecordSummary[];
  filters: CatalogFilters;
  onFiltersChange: (next: CatalogFilters) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}) {
  const router = useRouter();
  const parentRef = useRef<HTMLDivElement>(null);
  // A ref read during render is unsafe (react-hooks/refs) — `scrollMargin` is state, set
  // once after mount, so the render that consumes it is a normal re-render, not a
  // render-time ref read (the standard TanStack Virtual "window virtualizer" recipe,
  // adapted to satisfy the React Compiler's stricter render-purity rule).
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    setScrollMargin(parentRef.current?.offsetTop ?? 0);
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: records.length,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    scrollMargin,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastItem = virtualItems[virtualItems.length - 1];
  const lastItemIndex = lastItem?.index;

  // Standard TanStack Virtual + infinite-query recipe: request the next page once the
  // last rendered row is within reach of the end of the loaded list. In an effect, not
  // during render — calling a mutating function as a render-time side effect can fire
  // repeatedly before `isFetchingNextPage` commits, hammering the mock server.
  useEffect(() => {
    if (lastItemIndex === undefined) return;
    if (lastItemIndex >= records.length - 8 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [lastItemIndex, records.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div
      role="table"
      aria-label={`Records — ${records.length}${hasNextPage ? "+" : ""} loaded`}
      // No `overflow` value of any kind here. `overflow-x-auto` would also compute
      // `overflow-y` to `auto` (CSS overflow spec), turning this div into a scrollport and
      // breaking `useWindowVirtualizer`'s assumption that the page is the scroller; and
      // `overflow-hidden` makes this an ancestor scroll container, which silently disables
      // the sticky column header below. Columns are sized to fit instead (see COLUMNS).
      className="border-border bg-card rounded-sm border"
    >
      {/* Sticky header (Stitch DESIGN.md §Components: "data tables … sticky headers").
          The `sticky` lives on the *rowgroup*, not the row: a sticky element can only
          travel within its own parent's box, and the row's parent is this rowgroup — which
          is only as tall as the header itself, so sticking it there would be a no-op.
          `top-14` parks it directly under the 3.5rem chrome bar. */}
      <div role="rowgroup" className="bg-muted border-border sticky top-14 z-10 border-b">
        <div role="row" className="text-muted-foreground flex items-center">
          {COLUMNS.map((col) => (
            <div
              key={col.label}
              role="columnheader"
              className={cn("label-caps px-3 py-2.5", col.className)}
            >
              {col.key ? (
                <SortButton
                  label={col.label}
                  field={col.key}
                  filters={filters}
                  onFiltersChange={onFiltersChange}
                />
              ) : (
                col.label
              )}
            </div>
          ))}
        </div>
      </div>

      <div ref={parentRef} role="rowgroup">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
          {virtualItems.map((virtualRow) => {
            const record = records[virtualRow.index];
            if (!record) return null;
            return (
              <div
                key={record.id}
                data-testid="catalog-row"
                data-index={virtualRow.index}
                role="row"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start - scrollMargin}px)`,
                }}
                className={cn(
                  "border-border hairline hover:bg-accent/50 focus-within:bg-accent/50 flex cursor-pointer items-center border-b transition-colors",
                  statusBand(
                    RECORD_STATUS_SEMANTIC[record.status],
                    BANDED_STATUSES.has(record.status),
                  ),
                )}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("a,button")) return;
                  router.push(`/catalog/${record.id}`);
                }}
              >
                <div className={cn("min-w-0 px-3 py-2", COLUMNS[0].className)} role="cell">
                  <Link
                    href={`/catalog/${record.id}`}
                    className="text-foreground focus-visible:ring-ring/50 block truncate text-sm font-medium underline-offset-2 hover:underline focus-visible:ring-3 focus-visible:outline-none"
                  >
                    {record.mpnRaw}
                  </Link>
                  <p className="text-muted-foreground truncate text-xs">{record.descriptionRaw}</p>
                  <RecordStatusBadge status={record.status} className="mt-1" />
                </div>

                <div className={cn("min-w-0 px-3 py-2", COLUMNS[1].className)} role="cell">
                  {record.class ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="truncate text-sm">{record.class.name}</span>
                      <ConfidenceIndicator
                        value={record.class.confidence}
                        provenance={record.class.provenanceKind}
                      />
                    </div>
                  ) : (
                    <span className="text-status-rejected text-xs font-medium">Unclassified</span>
                  )}
                </div>

                <div className={cn("px-3 py-2", COLUMNS[2].className)} role="cell">
                  <CompletenessBar completeness={record.completeness} />
                </div>

                <div className={cn("px-3 py-2", COLUMNS[3].className)} role="cell">
                  <StatusMix completeness={record.completeness} />
                </div>

                <div
                  className={cn("metric px-3 py-2 text-right text-sm", COLUMNS[4].className)}
                  role="cell"
                >
                  {record.tier0PendingCount > 0 ? (
                    <span className="text-status-needs-approval font-semibold">
                      {record.tier0PendingCount}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </div>

                <div
                  className={cn("metric px-3 py-2 text-right text-sm", COLUMNS[5].className)}
                  role="cell"
                >
                  {record.unknownCount > 0 ? (
                    <span className="text-status-unknown font-semibold">{record.unknownCount}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </div>

                <div className={cn("px-3 py-2", COLUMNS[6].className)} role="cell">
                  {record.hasDocument ? (
                    <FileCheck
                      role="img"
                      className="text-status-accepted size-4"
                      aria-label="Document bound"
                    />
                  ) : (
                    <FileWarning
                      role="img"
                      className="text-status-rejected size-4"
                      aria-label="No document bound"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer strip — the Stitch catalog closes its table with a bar stating the size
          of the visible slice on the left and the pagination control on the right. Ours
          states what a cursor-paginated list can honestly claim ("Showing N records",
          with "+ more available" while a cursor remains) rather than an invented total,
          and the control is "Load more" because that is what the API supports. */}
      <div className="border-border bg-muted/40 flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2">
        <p className="metric text-muted-foreground text-xs">
          Showing {records.length} record{records.length === 1 ? "" : "s"}
          {hasNextPage ? " — more available" : ""}
        </p>
        {hasNextPage ? (
          <Button variant="outline" size="xs" onClick={fetchNextPage} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function SortButton({
  label,
  field,
  filters,
  onFiltersChange,
}: {
  label: string;
  field: "mpn_raw" | "completeness" | "unknown_count" | "tier0_pending_count";
  filters: CatalogFilters;
  onFiltersChange: (next: CatalogFilters) => void;
}) {
  const active = sortField(filters.sort) === field;
  const Icon = active
    ? sortDirection(filters.sort) === "asc"
      ? ChevronUp
      : ChevronDown
    : ChevronsUpDown;
  return (
    <Button
      variant="ghost"
      size="xs"
      className={cn(
        "label-caps -mx-1.5 h-auto gap-1 px-1.5 py-0",
        active ? "text-foreground" : "text-muted-foreground",
      )}
      onClick={() => onFiltersChange({ ...filters, sort: toggleSort(filters.sort, field) })}
      aria-label={`Sort by ${label}${active ? `, currently ${sortDirection(filters.sort)}ending` : ""}`}
    >
      {label}
      <Icon className="size-3" aria-hidden="true" />
    </Button>
  );
}
