"use client";

/**
 * Record query hooks — `GET /records` (cursor-paginated, infinite), `GET /records/{id}`,
 * `PATCH /records/{id}/class`, `POST /records/{id}/enrich` (docs/api.md §Records).
 * The only place a component reaches these wire routes; components consume the
 * camelCase domain types this module returns, never `apiFetch` directly
 * (docs/14-frontend-implementation-plan.md §4.1, §7 "no component fetches directly").
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { queryKeys } from "./keys";
import {
  adaptRecordDetail,
  adaptRecordSummary,
  type RecordDetail,
  type RecordSummary,
} from "@/lib/contracts/record";
import { adaptCursorPage } from "@/lib/contracts/common";
import { catalogFiltersToWireQuery, type CatalogFilters } from "@/lib/catalog/filters";

export const CATALOG_PAGE_LIMIT = 50;

export function useRecordsInfiniteQuery(filters: CatalogFilters) {
  const query = catalogFiltersToWireQuery(filters);
  return useInfiniteQuery({
    queryKey: queryKeys.records.list(query),
    queryFn: async ({ pageParam }) => {
      const wire = await apiFetch<{ items: unknown[]; next_cursor: string | null }>("/records", {
        query: { ...query, cursor: pageParam, limit: CATALOG_PAGE_LIMIT },
      });
      return adaptCursorPage(wire, adaptRecordSummary);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

/** Flattens an infinite query's pages into one array — the shape every consumer wants. */
export function flattenRecordPages(
  pages: { items: RecordSummary[] }[] | undefined,
): RecordSummary[] {
  return pages?.flatMap((page) => page.items) ?? [];
}

export function useRecordDetailQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.records.detail(id),
    queryFn: () => apiFetch(`/records/${id}`).then(adaptRecordDetail),
  });
}

/** Manual reclassification — writes `HUMAN` provenance (docs/api.md §Records). */
export function useReclassifyMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (classCode: string) =>
      apiFetch(`/records/${id}/class`, {
        method: "PATCH",
        body: { class_code: classCode },
      }).then(adaptRecordDetail),
    onSuccess: (detail: RecordDetail) => {
      queryClient.setQueryData(queryKeys.records.detail(id), detail);
      queryClient.invalidateQueries({ queryKey: ["records", "list"] });
    },
  });
}

/** Re-run the pipeline. Stubbed on the mock side (F0.5) — acknowledges with a `run_id`
 *  rather than mutating the record; full wiring into `/runs/:id` is F4. */
export function useEnrichMutation(id: string) {
  return useMutation({
    mutationFn: (body: { fromStage?: string; force?: boolean } = {}) =>
      apiFetch<{ run_id: string }>(`/records/${id}/enrich`, {
        method: "POST",
        body: { from_stage: body.fromStage, force: body.force },
      }),
  });
}
