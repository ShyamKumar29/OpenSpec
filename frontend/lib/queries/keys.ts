/**
 * Query key conventions (docs/06-frontend.md §6). Centralised so invalidation targets
 * are typo-proof and every phase from F1 on reuses the same keys instead of inventing
 * per-page ones. Filters/sort/pagination themselves live in the URL, never here or in
 * component state — these keys just need to include whatever varies the response.
 */
export const queryKeys = {
  records: {
    list: (filters: Record<string, unknown>) => ["records", "list", filters] as const,
    detail: (id: string) => ["records", "detail", id] as const,
  },
  attributes: {
    explain: (id: string) => ["attributes", "explain", id] as const,
    history: (id: string) => ["attributes", "history", id] as const,
  },
  documents: {
    list: (filters: Record<string, unknown>) => ["documents", "list", filters] as const,
    detail: (versionId: string) => ["documents", "detail", versionId] as const,
    regions: (versionId: string) => ["documents", "regions", versionId] as const,
  },
  review: {
    tasks: (filters: Record<string, unknown>) => ["review", "tasks", filters] as const,
    counts: () => ["review", "counts"] as const,
    next: (reasonCode?: string) => ["review", "next", reasonCode ?? null] as const,
    sessionStats: () => ["review", "session-stats"] as const,
  },
  runs: {
    list: (filters: Record<string, unknown>) => ["runs", "list", filters] as const,
    detail: (id: string) => ["runs", "detail", id] as const,
  },
  judge: {
    run: (id: string) => ["judge", "run", id] as const,
  },
  evaluation: {
    list: () => ["evaluation", "list"] as const,
    detail: (id: string) => ["evaluation", "detail", id] as const,
  },
  metrics: {
    catalogHealth: () => ["metrics", "catalog-health"] as const,
    throughput: () => ["metrics", "throughput"] as const,
    qualityTrend: () => ["metrics", "quality-trend"] as const,
  },
} as const;
