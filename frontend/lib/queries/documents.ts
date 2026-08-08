"use client";

/**
 * Document metadata query — `GET /documents/{version_id}` (docs/api.md §Documents).
 * F1 only needs this for the evidence popover's document title/publisher (a text
 * citation, not the rendered page — that's `DocumentViewer`, F2). Kept as its own hook
 * so F2 can reuse it unchanged.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { queryKeys } from "./keys";
import { adaptDocumentDetail } from "@/lib/contracts/document";

export function useDocumentQuery(versionId: string | null) {
  return useQuery({
    queryKey: queryKeys.documents.detail(versionId ?? "none"),
    queryFn: () => apiFetch(`/documents/${versionId}`).then(adaptDocumentDetail),
    enabled: versionId !== null,
    staleTime: 5 * 60_000,
  });
}
