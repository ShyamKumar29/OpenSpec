/**
 * `/documents` filter state — URL search params only, mirroring the catalog's rule
 * (docs/06-frontend.md §6; lib/catalog/filters.ts).
 *
 * Two kinds of filter live here, and the distinction matters:
 *
 *   - `parseStatus` and `boundCount` are **server filters**. They map onto `GET /documents`
 *     exactly as documented (docs/api.md §Documents: `parse_status`, `bound_count`) and are
 *     sent as query parameters.
 *
 *   - `q` and `publishers` are **client refinements**. They narrow the page the server
 *     already returned and are never sent anywhere. The Stitch corpus browser draws a
 *     "SEARCH CORPUS" field and a counted "MANUFACTURER" facet; both are reproduced here
 *     over data already in hand rather than by inventing request parameters the API does
 *     not define (a server-side publisher filter would need a distinct-values endpoint,
 *     which is not in api.md — D2). They still live in the URL so the corpus browser keeps
 *     the same shareable, back-button-correct behaviour as every other list in the app.
 */
import { PARSE_STATUSES, type ParseStatus } from "@/lib/contracts/document";
import type { DocumentSummary } from "@/lib/contracts/document";

export type BoundCountFilter = "0" | "gt0" | null;

export interface DocumentFilters {
  /** Server filter — `GET /documents?parse_status=`. */
  parseStatus: ParseStatus | null;
  /** Server filter — `GET /documents?bound_count=`. */
  boundCount: BoundCountFilter;
  /** Client refinement — substring match over title and publisher. */
  q: string;
  /** Client refinement — publisher names to keep. Empty means "all". */
  publishers: string[];
}

export const DEFAULT_DOCUMENT_FILTERS: DocumentFilters = {
  parseStatus: null,
  boundCount: null,
  q: "",
  publishers: [],
};

export function parseDocumentFilters(params: URLSearchParams): DocumentFilters {
  const parseStatusRaw = params.get("parse_status");
  const boundCountRaw = params.get("bound_count");
  const publishersRaw = params.get("publisher");
  return {
    parseStatus:
      parseStatusRaw && (PARSE_STATUSES as readonly string[]).includes(parseStatusRaw)
        ? (parseStatusRaw as ParseStatus)
        : null,
    boundCount: boundCountRaw === "0" || boundCountRaw === "gt0" ? boundCountRaw : null,
    q: params.get("q") ?? "",
    publishers: publishersRaw ? publishersRaw.split("~").filter(Boolean) : [],
  };
}

export function documentFiltersToSearchParams(filters: DocumentFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.parseStatus) params.set("parse_status", filters.parseStatus);
  if (filters.boundCount) params.set("bound_count", filters.boundCount);
  if (filters.q) params.set("q", filters.q);
  // `~` rather than `,`: publisher names legitimately contain commas ("Sterling Valve &
  // Fitting Co., Inc."), and a comma-joined list would split one name into two facets.
  if (filters.publishers.length > 0) params.set("publisher", filters.publishers.join("~"));
  return params;
}

export function hasActiveDocumentFilters(filters: DocumentFilters): boolean {
  return (
    filters.parseStatus !== null ||
    filters.boundCount !== null ||
    filters.q.trim() !== "" ||
    filters.publishers.length > 0
  );
}

/** Applies the client refinements (`q`, `publishers`) to a server-filtered page. */
export function applyClientDocumentFilters(
  documents: readonly DocumentSummary[],
  filters: DocumentFilters,
): DocumentSummary[] {
  const needle = filters.q.trim().toLowerCase();
  return documents.filter((doc) => {
    if (filters.publishers.length > 0 && !filters.publishers.includes(doc.publisher)) return false;
    if (!needle) return true;
    return doc.title.toLowerCase().includes(needle) || doc.publisher.toLowerCase().includes(needle);
  });
}
