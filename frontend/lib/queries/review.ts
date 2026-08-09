"use client";

/**
 * Review queue query hooks (docs/api.md §Review). The only place a component reaches
 * these wire routes — components consume the camelCase `ReviewTask`/`ReviewCounts`/
 * `SessionStats` domain types, never `apiFetch` directly (docs/14-frontend-
 * implementation-plan.md §4.1). Optimistic state (removing a decided task from the
 * on-screen queue, advancing position) is owned by `ReviewQueueView`, not here — these
 * mutations are thin wrappers that fire the request and invalidate the counts/session
 * stats that must reflect it; NFR-PERF-8 ("keystroke ≤100ms, handlers never await the
 * network") is a property of the *caller's* keyboard handler, not of the mutation.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { queryKeys } from "./keys";
import { adaptCursorPage } from "@/lib/contracts/common";
import {
  adaptReviewCounts,
  adaptReviewTask,
  adaptSessionStats,
  type ReviewReasonCode,
  type ReviewTask,
} from "@/lib/contracts/review";
import type { UnknownReason } from "@/lib/contracts/attribute-value";
import { documentDetailQueryOptions, documentRegionsQueryOptions } from "./documents";
import { apiUrl } from "@/lib/api/client";

export const REVIEW_TASK_PAGE_LIMIT = 100;

export function useReviewCountsQuery() {
  return useQuery({
    queryKey: queryKeys.review.counts(),
    queryFn: () => apiFetch("/review/tasks/counts").then(adaptReviewCounts),
  });
}

export function useSessionStatsQuery() {
  return useQuery({
    queryKey: queryKeys.review.sessionStats(),
    queryFn: () => apiFetch("/review/session/stats").then(adaptSessionStats),
  });
}

/** `GET /review/tasks` — the queue for one reason-code tab (`null` = every open reason
 *  code, matching the wireframe's aggregate "412 open" header). Cursor-paginated
 *  (docs/api.md); loaded incrementally as the reviewer's position approaches the end of
 *  what's already fetched, not all up front — a tab can hold 140+ tasks. */
export function useReviewTasksQuery(reasonCode: ReviewReasonCode | null) {
  const filters = { reason_code: reasonCode ?? undefined };
  return useInfiniteQuery({
    queryKey: queryKeys.review.tasks(filters),
    queryFn: async ({ pageParam }) => {
      const wire = await apiFetch<{ items: unknown[]; next_cursor: string | null }>(
        "/review/tasks",
        { query: { ...filters, cursor: pageParam, limit: REVIEW_TASK_PAGE_LIMIT } },
      );
      return adaptCursorPage(wire, adaptReviewTask);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
  });
}

export function flattenReviewTaskPages(pages: { items: ReviewTask[] }[] | undefined): ReviewTask[] {
  return pages?.flatMap((page) => page.items) ?? [];
}

/** Warms the document detail/regions cache and the browser's image cache for the page a
 *  task's evidence lives on — "Never waiting" (docs/06-frontend.md §1 Thesis 2). Called
 *  by `ReviewQueueView` whenever the current task changes, targeting task *n+1*. A
 *  no-op for tasks with no bound document (NO_DOCUMENT reason code). */
export function prefetchTaskEvidence(
  queryClient: QueryClient,
  task: ReviewTask | null | undefined,
) {
  if (!task?.documentVersionId) return;
  const versionId = task.documentVersionId;
  void queryClient.prefetchQuery(documentDetailQueryOptions(versionId));
  void queryClient.prefetchQuery(documentRegionsQueryOptions(versionId));
  if (task.page && typeof window !== "undefined") {
    const img = new window.Image();
    img.src = apiUrl(`/documents/${versionId}/pages/${task.page}/image`);
  }
}

function invalidateAfterDecision(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.review.counts() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.review.sessionStats() });
  void queryClient.invalidateQueries({ queryKey: ["review", "tasks"] });
}

export interface DecisionResult {
  task: unknown;
  attribute_value: unknown;
}

/** `POST /review/tasks/{id}/accept` — accept the proposed value. Never called for a
 *  Tier 0 task (INV-9): the decision bar renders `useApproveTaskMutation` instead, a
 *  structurally separate code path, not a conditional branch of this one. */
export function useAcceptTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      apiFetch<DecisionResult>(`/review/tasks/${taskId}/accept`, { method: "POST" }),
    onSuccess: () => invalidateAfterDecision(queryClient),
  });
}

/** `POST /review/tasks/{id}/approve` — Tier 0 sign-off. The only affirmative action ever
 *  offered for a Tier 0 task (INV-9). */
export function useApproveTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      apiFetch<DecisionResult>(`/review/tasks/${taskId}/approve`, { method: "POST" }),
    onSuccess: () => invalidateAfterDecision(queryClient),
  });
}

/** `POST /review/tasks/{id}/reject` — reject to `Unknown` with a reason. Powers both the
 *  `R` ("reject the proposed value") and `U` ("assert Unknown directly") decision-bar
 *  actions — they differ only in which reason they pass
 *  (lib/review/reason-mapping.ts), not in the request they make. */
export function useRejectTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, reason }: { taskId: string; reason: UnknownReason }) =>
      apiFetch<DecisionResult>(`/review/tasks/${taskId}/reject`, {
        method: "POST",
        body: { reason },
      }),
    onSuccess: () => invalidateAfterDecision(queryClient),
  });
}

/** `POST /review/tasks/{id}/correct` — `{ value, reason }` -> new `HUMAN` value
 *  supersedes (docs/api.md §Review). Backs both the `E` (edit) and `D` (reattach)
 *  decision-bar actions: reattach is a correction whose value and reason happen to come
 *  from a reviewer-picked document region rather than free text (no separate
 *  "reattach evidence" endpoint exists in docs/api.md — D2 forbids inventing one). */
export function useCorrectTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, value, reason }: { taskId: string; value: string; reason: string }) =>
      apiFetch<DecisionResult>(`/review/tasks/${taskId}/correct`, {
        method: "POST",
        body: { value, reason },
      }),
    onSuccess: () => invalidateAfterDecision(queryClient),
  });
}

export interface BulkReviewResult {
  applied: number;
  skipped: number;
  total: number;
}

/** `POST /review/bulk` — `{ task_ids[], action, value? }` with a confirmation summary
 *  (docs/api.md §Review). The mock supports `accept`/`reject` only (Tier 0 bulk-approve
 *  is deliberately not offered — mocks/server routes for /review/bulk). */
export function useBulkReviewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskIds, action }: { taskIds: string[]; action: "accept" | "reject" }) =>
      apiFetch<BulkReviewResult>("/review/bulk", {
        method: "POST",
        body: { task_ids: taskIds, action },
      }),
    onSuccess: () => invalidateAfterDecision(queryClient),
  });
}
