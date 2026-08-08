"use client";

/** Export — `GET /export/targets`, `POST /export` (docs/api.md §Export). */
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

export interface ExportTarget {
  code: string;
  name: string;
}

export function useExportTargetsQuery() {
  return useQuery({
    queryKey: ["export", "targets"] as const,
    queryFn: () => apiFetch<{ targets: ExportTarget[] }>("/export/targets"),
    staleTime: Infinity,
  });
}

export type ExportPolicy = "auto_accepted_only" | "human_approved_only" | "all_with_flags";

export interface ExportRequest {
  target: string;
  filter: Record<string, unknown>;
  includeProvenance: boolean;
  policy: ExportPolicy;
}

export function useExportMutation() {
  return useMutation({
    mutationFn: (body: ExportRequest) =>
      apiFetch<{ export_id: string }>("/export", {
        method: "POST",
        body: {
          target: body.target,
          filter: body.filter,
          include_provenance: body.includeProvenance,
          policy: body.policy,
        },
      }),
  });
}
