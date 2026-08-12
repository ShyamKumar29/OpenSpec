"use client";

/**
 * Run and Judge Mode query hooks (docs/api.md §Runs & progress, §Judge Mode). The one
 * place a component reaches `/runs/*` and `/judge/*` — components consume `Run`
 * (camelCase) via these hooks, never `apiFetch` directly (docs/14-frontend-
 * implementation-plan.md §4.1). Live progress itself comes from `lib/run-events`
 * (`useRunStream`), not from these hooks — this module is for the run's identity,
 * authoritative status, and totals, fetched once and refetched on demand, not streamed.
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch } from "@/lib/api/client";
import { queryKeys } from "./keys";
import { adaptCursorPage, type CursorPage } from "@/lib/contracts/common";
import { adaptRun, type Run, type RunKind, type RunStatus } from "@/lib/contracts/run";

const judgeRunResponseWireSchema = z.object({ run_id: z.string() });

export interface JudgeRunInput {
  mpn: string;
  description: string;
  /** Explicitly selects one of the three scripted scenarios (docs/14-frontend-
   *  implementation-plan.md §4.2). Omitted for free-text/unrehearsed input — the mock
   *  falls back to matching the canonical MPN, then to the safe abstain path, which is
   *  exactly the honest behaviour FR-JDG-1/5 asks of a hostile or unrecognised input. */
  scenario?: "success" | "abstain" | "rejected";
  /** Filename only — the mock never parses an uploaded PDF (ADR-0012: rasterisation is
   *  server-side and, for judge input, there is no server to rasterise an ad-hoc file
   *  against). Acknowledged in the UI, not wired into the scripted stage narration. */
  documentName?: string | null;
}

/** `POST /judge/run` — docs/api.md §Judge Mode. */
export function useJudgeRunMutation() {
  return useMutation({
    mutationFn: async (input: JudgeRunInput) => {
      const wire = await apiFetch<unknown>("/judge/run", {
        method: "POST",
        body: {
          mpn: input.mpn || undefined,
          description: input.description || undefined,
          scenario: input.scenario,
          document: input.documentName ? { filename: input.documentName } : undefined,
        },
      });
      return judgeRunResponseWireSchema.parse(wire).run_id;
    },
  });
}

/** `GET /judge/runs/{id}` — full intermediate output for every stage, for the run this
 *  session itself just started (docs/api.md §Judge Mode). */
export function useJudgeRunDetailQuery(runId: string | null) {
  return useQuery({
    queryKey: queryKeys.judge.run(runId ?? "none"),
    queryFn: () => apiFetch(`/judge/runs/${runId}`).then(adaptRun),
    enabled: runId !== null,
    // A judge run is scripted and immutable once created — no reason to treat a cached
    // read as stale mid-demo.
    staleTime: Infinity,
  });
}

/** `GET /runs/{id}` — run status, per-stage progress, cost, token totals (docs/api.md
 *  §Runs & progress). Used by `/runs/:id`, and reusable by anything else that only has a
 *  bare `run_id` (e.g. Re-enrich's response). */
export function useRunDetailQuery(runId: string | null) {
  return useQuery({
    queryKey: queryKeys.runs.detail(runId ?? "none"),
    queryFn: () => apiFetch(`/runs/${runId}`).then(adaptRun),
    enabled: runId !== null,
    staleTime: Infinity,
  });
}

/** `POST /runs/{id}/cancel` — cooperative cancel between stages (docs/api.md §Runs &
 *  progress). Pairs with closing the event source client-side (`useRunStream().cancel`);
 *  this call is what persists the cancellation server-side. */
export function useRunCancelMutation() {
  return useMutation({
    mutationFn: (runId: string) =>
      apiFetch<unknown>(`/runs/${runId}/cancel`, { method: "POST" }).then(adaptRun),
  });
}

export interface RunListFilters {
  status?: RunStatus;
  kind?: RunKind;
}

/** `GET /runs` — list runs, most recent first (docs/api.md §Runs & progress, added F6).
 *  Powers the dashboard's active-runs panel (FR-DSH-5). A short `staleTime` rather than
 *  a subscription: the dashboard is a glance surface, not a live-narration one — the one
 *  run actually being narrated live on the page uses `useRunStream` directly, same as
 *  Judge Mode and `/runs/:id`. */
export function useRunsQuery(filters: RunListFilters = {}) {
  const query: Record<string, string> = {};
  if (filters.status) query.status = filters.status;
  if (filters.kind) query.kind = filters.kind;
  return useQuery({
    queryKey: queryKeys.runs.list(query),
    queryFn: async (): Promise<CursorPage<Run>> => {
      const wire = await apiFetch<{ items: unknown[]; next_cursor: string | null }>("/runs", {
        query: { ...query, limit: 25 },
      });
      return adaptCursorPage(wire, adaptRun);
    },
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
}

export type { Run };
