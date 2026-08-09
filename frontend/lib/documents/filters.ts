/**
 * `/documents` filter state — URL search params only, mirroring the catalog's rule
 * (docs/06-frontend.md §6; lib/catalog/filters.ts). Filters mirror `GET /documents`
 * (docs/api.md §Documents): `parse_status`, `bound_count`. `publisher` is omitted here —
 * the mock route matches it by exact string equality against ~18 documents' free-text
 * publisher names, which a text filter would rarely hit; a proper publisher facet needs
 * a distinct-values endpoint that isn't in api.md (D2), so it's left for a later phase.
 */
import { PARSE_STATUSES, type ParseStatus } from "@/lib/contracts/document";

export type BoundCountFilter = "0" | "gt0" | null;

export interface DocumentFilters {
  parseStatus: ParseStatus | null;
  boundCount: BoundCountFilter;
}

export const DEFAULT_DOCUMENT_FILTERS: DocumentFilters = { parseStatus: null, boundCount: null };

export function parseDocumentFilters(params: URLSearchParams): DocumentFilters {
  const parseStatusRaw = params.get("parse_status");
  const boundCountRaw = params.get("bound_count");
  return {
    parseStatus:
      parseStatusRaw && (PARSE_STATUSES as readonly string[]).includes(parseStatusRaw)
        ? (parseStatusRaw as ParseStatus)
        : null,
    boundCount: boundCountRaw === "0" || boundCountRaw === "gt0" ? boundCountRaw : null,
  };
}

export function documentFiltersToSearchParams(filters: DocumentFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.parseStatus) params.set("parse_status", filters.parseStatus);
  if (filters.boundCount) params.set("bound_count", filters.boundCount);
  return params;
}

export function hasActiveDocumentFilters(filters: DocumentFilters): boolean {
  return filters.parseStatus !== null || filters.boundCount !== null;
}
