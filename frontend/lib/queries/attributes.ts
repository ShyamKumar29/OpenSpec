"use client";

/**
 * `GET /attributes/{id}/explain` — the Why panel's data source (docs/api.md §Attribute
 * values). The Why panel consumes this hook exclusively; it never re-reads the record's
 * own (already-fetched) `AttributeValue`, because `explain` is the payload documented to
 * carry validation, the normalisation chain, and the confidence signal vector that the
 * core DTO does not (docs/14-frontend-implementation-plan.md §6 F3).
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { queryKeys } from "./keys";
import { adaptAttributeExplain } from "@/lib/contracts/explain";

export function useAttributeExplainQuery(attributeValueId: string | null) {
  return useQuery({
    queryKey: queryKeys.attributes.explain(attributeValueId ?? "none"),
    queryFn: () => apiFetch(`/attributes/${attributeValueId}/explain`).then(adaptAttributeExplain),
    enabled: attributeValueId !== null,
    staleTime: 60_000,
  });
}
