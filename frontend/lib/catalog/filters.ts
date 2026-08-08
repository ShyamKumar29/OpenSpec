/**
 * Catalog filter/sort state — URL search params are the only store
 * (docs/06-frontend.md §6: "Filters, sort, pagination → URL search params … Shareable,
 * back-button-correct, no state duplication"; docs/14-frontend-implementation-plan.md
 * §6 F1: "filters live in the URL, never in component state").
 *
 * Filters mirror `GET /records` exactly (docs/api.md §Records, restated in
 * docs/14-frontend-implementation-plan.md §6 F1): `class_id`, `status`,
 * `completeness_lt`, `supplier`, `q`, `has_unknown_reason`. `sort` is additive within
 * the same endpoint (D2 governs routes, not every query param — see the precedent note
 * on `RecordSummary` in lib/contracts/record.ts) so column-header sorting doesn't
 * require a new route.
 */
import { RECORD_STATUSES, type RecordStatus } from "@/lib/contracts/record";

const SORT_FIELDS = ["mpn_raw", "completeness", "unknown_count", "tier0_pending_count"] as const;
type SortField = (typeof SORT_FIELDS)[number];
export type CatalogSortKey = SortField | `-${SortField}`;

export const DEFAULT_SORT: CatalogSortKey = "-tier0_pending_count";

export interface CatalogFilters {
  q: string;
  classCode: string | null;
  status: RecordStatus | null;
  /** Fraction in (0, 1] — records with completeness ratio below this. */
  completenessLt: number | null;
  supplier: string | null;
  hasUnknownReason: boolean;
  sort: CatalogSortKey;
}

export const DEFAULT_CATALOG_FILTERS: CatalogFilters = {
  q: "",
  classCode: null,
  status: null,
  completenessLt: null,
  supplier: null,
  hasUnknownReason: false,
  sort: DEFAULT_SORT,
};

export const COMPLETENESS_LT_OPTIONS = [
  { value: 1, label: "Below 100%" },
  { value: 0.75, label: "Below 75%" },
  { value: 0.5, label: "Below 50%" },
  { value: 0.25, label: "Below 25%" },
] as const;

function isSortKey(value: string | null): value is CatalogSortKey {
  if (!value) return false;
  const field = (value.startsWith("-") ? value.slice(1) : value) as SortField;
  return (SORT_FIELDS as readonly string[]).includes(field);
}

export function sortField(sort: CatalogSortKey): SortField {
  return (sort.startsWith("-") ? sort.slice(1) : sort) as SortField;
}

export function sortDirection(sort: CatalogSortKey): "asc" | "desc" {
  return sort.startsWith("-") ? "desc" : "asc";
}

export function toggleSort(current: CatalogSortKey, field: SortField): CatalogSortKey {
  if (sortField(current) !== field) return field;
  return sortDirection(current) === "asc" ? (`-${field}` as CatalogSortKey) : field;
}

export function parseCatalogFilters(params: URLSearchParams): CatalogFilters {
  const status = params.get("status");
  const completenessLtRaw = params.get("completeness_lt");
  const completenessLt = completenessLtRaw === null ? null : Number(completenessLtRaw);
  const sortRaw = params.get("sort");

  return {
    q: params.get("q") ?? "",
    classCode: params.get("class_id") || null,
    status:
      status && (RECORD_STATUSES as readonly string[]).includes(status)
        ? (status as RecordStatus)
        : null,
    completenessLt:
      completenessLt !== null && Number.isFinite(completenessLt) && completenessLt > 0
        ? completenessLt
        : null,
    supplier: params.get("supplier") || null,
    hasUnknownReason: params.get("has_unknown_reason") === "true",
    sort: isSortKey(sortRaw) ? sortRaw : DEFAULT_SORT,
  };
}

export function catalogFiltersToSearchParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.classCode) params.set("class_id", filters.classCode);
  if (filters.status) params.set("status", filters.status);
  if (filters.completenessLt !== null)
    params.set("completeness_lt", String(filters.completenessLt));
  if (filters.supplier) params.set("supplier", filters.supplier);
  if (filters.hasUnknownReason) params.set("has_unknown_reason", "true");
  if (filters.sort !== DEFAULT_SORT) params.set("sort", filters.sort);
  return params;
}

/** The `GET /records` wire query object — `snake_case`, matching api.md's filter names. */
export function catalogFiltersToWireQuery(
  filters: CatalogFilters,
): Record<string, string | number | boolean | undefined> {
  return {
    q: filters.q || undefined,
    class_id: filters.classCode ?? undefined,
    status: filters.status ?? undefined,
    completeness_lt: filters.completenessLt ?? undefined,
    supplier: filters.supplier ?? undefined,
    has_unknown_reason: filters.hasUnknownReason ? true : undefined,
    sort: filters.sort !== DEFAULT_SORT ? filters.sort : undefined,
  };
}

export function hasActiveCatalogFilters(filters: CatalogFilters): boolean {
  return (
    filters.q !== "" ||
    filters.classCode !== null ||
    filters.status !== null ||
    filters.completenessLt !== null ||
    filters.supplier !== null ||
    filters.hasUnknownReason
  );
}
