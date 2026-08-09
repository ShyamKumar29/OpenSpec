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

export function useDocumentQuery(versionId: string | null) {
  return useQuery({
    queryKey: queryKeys.documents.detail(versionId ?? "none"),
    queryFn: () => apiFetch(`/documents/${versionId}`).then(adaptDocumentDetail),
    enabled: versionId !== null,
    staleTime: 5 * 60_000,
  });
}

/** `GET /documents/{version_id}/regions` — the region tree that powers the highlight
 *  overlay and `RegionOverlay` (docs/api.md §Documents). Cached alongside the page image
 *  and document metadata — all three are static once a document version is parsed. */
export function useDocumentRegionsQuery(versionId: string | null) {
  return useQuery({
    queryKey: queryKeys.documents.regions(versionId ?? "none"),
    queryFn: () =>
      apiFetch<{ regions: unknown[] }>(`/documents/${versionId}/regions`).then((wire) =>
        wire.regions.map(adaptDocumentRegion),
      ),
    enabled: versionId !== null,
    staleTime: 5 * 60_000,
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
