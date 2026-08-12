"use client";

/**
 * Evaluation run query hooks (docs/api.md §Evaluation & dashboard, docs/14-frontend-
 * implementation-plan.md §6 F7). The one place a component reaches `/eval/runs*` —
 * components consume `EvalRunSummary` / `EvalRunDetail` (camelCase) via these hooks,
 * never `apiFetch` directly, same discipline as `lib/queries/metrics.ts`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { queryKeys } from "./keys";
import {
  adaptEvalRunDetail,
  adaptEvalRunSummary,
  type EvalRunDetail,
  type EvalRunSummary,
} from "@/lib/contracts/eval";

/** `GET /eval/runs` — history with metric deltas. Eval runs are gold-set, offline
 *  measurements — nothing in the live catalog changes them — so this is a one-shot
 *  fetch, not a polling subscription like the dashboard's `/metrics/*` queries. */
export function useEvalRunsQuery() {
  return useQuery<EvalRunSummary[]>({
    queryKey: queryKeys.evaluation.list(),
    queryFn: async () => {
      const wire = await apiFetch<{ items: unknown[] }>("/eval/runs");
      return wire.items.map(adaptEvalRunSummary);
    },
    staleTime: 60_000,
  });
}

/** `GET /eval/runs/{id}` — metrics with CIs, per-slice breakdown, frontier + reliability
 *  data, ablation table. Only the most recent run carries the full detail payload in
 *  this fixture set (`mocks/fixtures/eval-runs.ts`); historical runs still resolve, with
 *  empty `sliceMetrics`/`frontier`/`reliability`/`ablation` arrays, which the view
 *  renders as an honest "not retained for this run" empty state rather than a crash. */
export function useEvalRunDetailQuery(runId: string | null) {
  return useQuery<EvalRunDetail>({
    queryKey: queryKeys.evaluation.detail(runId ?? "none"),
    queryFn: () => apiFetch(`/eval/runs/${runId}`).then(adaptEvalRunDetail),
    enabled: runId !== null,
    staleTime: 60_000,
  });
}

/** `POST /eval/runs` — trigger an evaluation run. The mock only acknowledges the request
 *  and returns the latest existing run id (docs §Evaluation & dashboard; the harness
 *  itself, `make eval`, is a backend/CI concern per docs/09-testing.md §6) — the caller
 *  is expected to report that honestly rather than imply a fresh run just appeared. */
export function useTriggerEvalRunMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ eval_run_id: string }>("/eval/runs", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.evaluation.list() });
    },
  });
}
