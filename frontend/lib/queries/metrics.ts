"use client";

/**
 * Dashboard/evaluation metrics query hooks (docs/api.md §Evaluation & dashboard,
 * docs/14-frontend-implementation-plan.md §6 F6). The one place a component reaches
 * `/metrics/*` — components consume the camelCase `CatalogHealth` / `Throughput` /
 * `QualityTrend` domain types, never `apiFetch` directly. All three endpoints read
 * straight off the live fixture store (mocks/fixtures/aggregates.ts), so a review
 * decision made in this browser tab is reflected the next time the dashboard refetches
 * — a short `staleTime` plus `refetchInterval` rather than a one-shot fetch, since the
 * dashboard's whole point is to look like a live operations surface, not a report
 * generated once on page load.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { queryKeys } from "./keys";
import {
  adaptCatalogHealth,
  adaptQualityTrend,
  adaptThroughput,
  type CatalogHealth,
  type QualityTrend,
  type Throughput,
} from "@/lib/contracts/eval";

const DASHBOARD_REFRESH_MS = 20_000;

/** `GET /metrics/catalog-health` — completeness, STP, unknown-reason breakdown
 *  (FR-DSH-1, QR-3/4, `01-requirements.md` §1.2). */
export function useCatalogHealthQuery() {
  return useQuery<CatalogHealth>({
    queryKey: queryKeys.metrics.catalogHealth(),
    queryFn: () => apiFetch("/metrics/catalog-health").then(adaptCatalogHealth),
    staleTime: DASHBOARD_REFRESH_MS,
    refetchInterval: DASHBOARD_REFRESH_MS,
  });
}

/** `GET /metrics/throughput` — SKUs/hr, cost/SKU, reviewer rate vs baseline
 *  (NFR-CST-1, FR-DSH-3, FR-RVW-9). */
export function useThroughputQuery() {
  return useQuery<Throughput>({
    queryKey: queryKeys.metrics.throughput(),
    queryFn: () => apiFetch("/metrics/throughput").then(adaptThroughput),
    staleTime: DASHBOARD_REFRESH_MS,
    refetchInterval: DASHBOARD_REFRESH_MS,
  });
}

/** `GET /metrics/quality-trend` — metric series over eval runs (FR-DSH-4). */
export function useQualityTrendQuery() {
  return useQuery<QualityTrend>({
    queryKey: queryKeys.metrics.qualityTrend(),
    queryFn: () => apiFetch("/metrics/quality-trend").then(adaptQualityTrend),
    staleTime: 60_000,
  });
}
