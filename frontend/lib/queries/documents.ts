"use client";

/**
 * Document query hooks — `GET /documents`, `GET /documents/{version_id}`,
 * `GET /documents/{version_id}/regions` (docs/api.md §Documents). `useDocumentQuery` was
 * F1's only consumer (the evidence popover's document title/publisher); F2 adds the
 * regions query and the corpus list query for `DocumentViewer` and `/documents`.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { queryKeys } from "./keys";
import { adaptCursorPage, type CursorPage } from "@/lib/contracts/common";
import {
  adaptDocumentDetail,
  adaptDocumentRegion,
  adaptDocumentSummary,
  type DocumentSummary,
} from "@/lib/contracts/document";

/** Shared `queryKey`/`queryFn`/`staleTime` for a document's detail, so the review
 *  queue's next-task prefetch (docs/06-frontend.md §6: "prefetch task n+1's payload and
 *  its document page image") warms the exact same cache entry `useDocumentQuery` reads,
 *  rather than re-describing the fetch. */
export function documentDetailQueryOptions(versionId: string) {
  return {
    queryKey: queryKeys.documents.detail(versionId),
    queryFn: () => apiFetch(`/documents/${versionId}`).then(adaptDocumentDetail),
    staleTime: 5 * 60_000,
  } as const;
}

export function documentRegionsQueryOptions(versionId: string) {
  return {
    queryKey: queryKeys.documents.regions(versionId),
    queryFn: () =>
      apiFetch<{ regions: unknown[] }>(`/documents/${versionId}/regions`).then((wire) =>
        wire.regions.map(adaptDocumentRegion),
      ),
    staleTime: 5 * 60_000,
  } as const;
}

export function useDocumentQuery(versionId: string | null) {
  return useQuery({
    ...documentDetailQueryOptions(versionId ?? "none"),
    enabled: versionId !== null,
  });
}

/** `GET /documents/{version_id}/regions` — the region tree that powers the highlight
 *  overlay and `RegionOverlay` (docs/api.md §Documents). Cached alongside the page image
 *  and document metadata — all three are static once a document version is parsed. */
export function useDocumentRegionsQuery(versionId: string | null) {
  return useQuery({
    ...documentRegionsQueryOptions(versionId ?? "none"),
    enabled: versionId !== null,
  });
}

export interface DocumentListFilters {
  publisher?: string;
  parseStatus?: string;
  boundCount?: "0" | "gt0";
}

function documentFiltersToWireQuery(filters: DocumentListFilters): Record<string, string> {
  const query: Record<string, string> = {};
  if (filters.publisher) query.publisher = filters.publisher;
  if (filters.parseStatus) query.parse_status = filters.parseStatus;
  if (filters.boundCount) query.bound_count = filters.boundCount;
  return query;
}

/** `GET /documents` — the corpus browser list (docs/api.md §Documents). Single-page
 *  cursor read (no infinite scroll — the corpus is ~18 documents in the fixture universe
 *  and expected to stay small relative to the catalog per docs/04-data-model.md §6). */
export function useDocumentsListQuery(filters: DocumentListFilters = {}) {
  const query = documentFiltersToWireQuery(filters);
  return useQuery({
    queryKey: queryKeys.documents.list(query),
    queryFn: async (): Promise<CursorPage<DocumentSummary>> => {
      const wire = await apiFetch<{ items: unknown[]; next_cursor: string | null }>("/documents", {
        query: { ...query, limit: 100 },
      });
      return adaptCursorPage(wire, adaptDocumentSummary);
    },
  });
}
