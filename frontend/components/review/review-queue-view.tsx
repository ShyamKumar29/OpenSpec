"use client";

/**
 * `/review` and `/review/:taskId` (docs/06-frontend.md §3.3, docs/14-frontend-
 * implementation-plan.md §6 F5 — protected budget, amendment A2). Owns the reviewer's
 * local session queue: which reason-code tab is active, position within it, optimistic
 * removal of decided tasks, next-task prefetch, and `sessionStorage` persistence
 * (FR-RVW-10). `/review` renders this with no `initialTaskId` (resumes the stored
 * session, or starts at the front of "All"); `/review/:taskId` passes one to deep-link a
 * specific task — both routes are the same screen, one screen matching the wireframe
 * rather than a separate list page and detail page.
 *
 * Queue order is intentionally *not* accumulated React state synchronised from the
 * query cache via an effect (that pattern cascades renders and is the one this file
 * originally shipped with, then removed — see the `react-hooks/set-state-in-effect`
 * rule). Instead the order is derived fresh from the query's already-stable fetch order
 * every render, and only the reviewer's own actions (skip, decide, switch tab) touch
 * `session` state, from event handlers, never from a `useEffect` body.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardCheck, Inbox, SearchX } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { LoadingBlock, LoadingCard } from "@/components/state/loading";
import { ErrorState } from "@/components/state/error-state";
import { EmptyState } from "@/components/state/empty-state";
import { DocumentViewer } from "@/components/document-viewer/document-viewer";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { useShortcut } from "@/lib/keyboard/registry";
import { QueueSidebar } from "./queue-sidebar";
import { TaskCard } from "./task-card";
import { DecisionBar, type ReviewDialogKind } from "./decision-bar";
import { ThroughputMeter } from "./throughput-meter";
import {
  useReviewCountsQuery,
  useReviewTasksQuery,
  useSessionStatsQuery,
  useAcceptTaskMutation,
  useApproveTaskMutation,
  useRejectTaskMutation,
  useCorrectTaskMutation,
  useBulkReviewMutation,
  flattenReviewTaskPages,
  prefetchTaskEvidence,
} from "@/lib/queries/review";
import { findSimilarTasks } from "@/lib/review/similar-tasks";
import {
  computeLocalThroughput,
  loadReviewSession,
  newReviewSession,
  recordDecision,
  saveReviewSession,
  type ReviewSessionState,
} from "@/lib/review/session-storage";
import type { ReviewReasonCode, ReviewTask } from "@/lib/contracts/review";
import type { UnknownReason } from "@/lib/contracts/attribute-value";

function initialSession(initialTaskId: string | undefined): ReviewSessionState {
  const stored = loadReviewSession();
  if (!initialTaskId) return stored ?? newReviewSession("ALL");
  // A deep link always wins over a stale stored position — jump straight to it, across
  // every reason code so it's findable regardless of which tab it lives in.
  return {
    ...(stored ?? newReviewSession("ALL")),
    reasonCode: "ALL",
    currentTaskId: initialTaskId,
  };
}

/** Index of `id` after removing it from `order`, clamped to the same visual slot the
 *  removed item held — the shared "what should the pointer land on next" rule for both
 *  a decision (task leaves the queue) and a skip (task moves to the back). */
function nextIdAfterRemoving(order: string[], id: string): string | null {
  const idx = order.indexOf(id);
  const remaining = order.filter((x) => x !== id);
  return remaining[Math.min(idx, remaining.length - 1)] ?? null;
}

export function ReviewQueueView({ initialTaskId }: { initialTaskId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const isMobile = useMediaQuery("(max-width: 767px)");

  const [session, setSession] = useState<ReviewSessionState>(() => initialSession(initialTaskId));
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [activeDialog, setActiveDialog] = useState<ReviewDialogKind>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const reasonCode = session.reasonCode;
  const counts = useReviewCountsQuery();
  const sessionStats = useSessionStatsQuery();
  const tasksQuery = useReviewTasksQuery(reasonCode === "ALL" ? null : reasonCode);
  const serverTasks = useMemo(
    () => flattenReviewTaskPages(tasksQuery.data?.pages),
    [tasksQuery.data],
  );
  const taskById = useMemo(() => new Map(serverTasks.map((t) => [t.id, t])), [serverTasks]);

  const acceptMutation = useAcceptTaskMutation();
  const approveMutation = useApproveTaskMutation();
  const rejectMutation = useRejectTaskMutation();
  const correctMutation = useCorrectTaskMutation();
  const bulkMutation = useBulkReviewMutation();

  // Skipped tasks render at the back, in the order skipped, rather than being hidden —
  // everything else keeps the query's own fetch order, recomputed fresh each render
  // (no separately accumulated/persisted ordering to keep in sync).
  const visibleOrder = useMemo(() => {
    const skipped = new Set(session.skippedIds);
    const primary = serverTasks
      .map((t) => t.id)
      .filter((id) => !removedIds.has(id) && !skipped.has(id));
    const deferred = session.skippedIds.filter((id) => !removedIds.has(id) && taskById.has(id));
    return [...primary, ...deferred];
  }, [serverTasks, session.skippedIds, removedIds, taskById]);

  // The task actually shown: the stored pointer if it's still in the visible queue,
  // otherwise the front of what's left — computed during render, not synchronised back
  // into state by an effect (there is nothing to "correct"; this variable *is* the
  // correction, every render).
  const effectiveTaskId =
    session.currentTaskId && visibleOrder.includes(session.currentTaskId)
      ? session.currentTaskId
      : (visibleOrder[0] ?? null);
  const currentTask: ReviewTask | null = effectiveTaskId
    ? (taskById.get(effectiveTaskId) ?? null)
    : null;
  const effectiveIndex = effectiveTaskId ? visibleOrder.indexOf(effectiveTaskId) : -1;

  // Deep link resolution: keep paging in until the requested task turns up or the tab
  // (here, "every open task") is exhausted.
  const stillResolvingDeepLink = !!initialTaskId && !taskById.has(initialTaskId);
  useEffect(() => {
    if (!stillResolvingDeepLink) return;
    if (tasksQuery.hasNextPage && !tasksQuery.isFetchingNextPage) {
      void tasksQuery.fetchNextPage();
    }
  }, [stillResolvingDeepLink, tasksQuery]);
  const deepLinkNotFound =
    stillResolvingDeepLink && tasksQuery.status === "success" && !tasksQuery.hasNextPage;

  // Reset the per-task decision-duration clock whenever the focused task changes. A ref,
  // not state — nothing needs to re-render off this, `commit()` only reads it when a
  // decision fires — and `Date.now()` is impure, so it belongs in an effect, not render.
  // This effect only ever writes a ref, never calls a `useState` setter, so it's outside
  // what `react-hooks/set-state-in-effect` targets.
  const taskOpenedAtRef = useRef<number>(0);
  useEffect(() => {
    taskOpenedAtRef.current = Date.now();
  }, [effectiveTaskId]);

  // Persist position + stats on every change (FR-RVW-10). Saves the *effective* pointer,
  // not the possibly-stale stored one, so a refresh resumes exactly where this render
  // landed rather than re-falling-back every time.
  useEffect(() => {
    saveReviewSession({ ...session, currentTaskId: effectiveTaskId });
  }, [session, effectiveTaskId]);

  // Keep the URL a durable, shareable pointer to the current task without polluting
  // browser history per keypress (docs/06-frontend.md §6: filters/position in the URL —
  // `replace`, not `push`, because Back stepping through hundreds of reviewed tasks
  // would be a trap, not a feature). Guarded on `stillResolvingDeepLink`: while a deep
  // link is still paging in search of its target, `currentTask` is a *temporary*
  // fallback (the front of whatever's loaded so far) — replacing the URL to it would
  // navigate away from `/review/:taskId` entirely, remounting this view with a new
  // `initialTaskId` and permanently losing the original target before it was ever found.
  useEffect(() => {
    if (!currentTask || stillResolvingDeepLink) return;
    const target = `/review/${currentTask.id}`;
    if (pathname !== target) router.replace(target, { scroll: false });
  }, [currentTask, stillResolvingDeepLink, pathname, router]);

  // "Never waiting": warm task n+1's document + regions + page image while task n is
  // open (docs/06-frontend.md §1 Thesis 2, §6).
  useEffect(() => {
    const nextId = visibleOrder[effectiveIndex + 1];
    prefetchTaskEvidence(queryClient, nextId ? taskById.get(nextId) : null);
  }, [visibleOrder, effectiveIndex, taskById, queryClient]);

  function selectReasonCode(code: ReviewReasonCode | "ALL") {
    if (code === session.reasonCode) return;
    setSession((prev) => ({ ...prev, reasonCode: code, currentTaskId: null, skippedIds: [] }));
    setRemovedIds(new Set());
  }

  function goTo(delta: number) {
    if (activeDialog || !effectiveTaskId) return;
    const next = effectiveIndex + delta;
    if (next < 0) return;
    if (next >= visibleOrder.length) {
      if (tasksQuery.hasNextPage) void tasksQuery.fetchNextPage();
      return;
    }
    setSession((prev) => ({ ...prev, currentTaskId: visibleOrder[next] }));
  }

  useShortcut({
    id: "review-nav-next",
    keys: "j",
    display: "J",
    description: "Next task",
    scope: "Review navigation",
    handler: () => goTo(1),
  });
  useShortcut({
    id: "review-nav-prev",
    keys: "k",
    display: "K",
    description: "Previous task",
    scope: "Review navigation",
    handler: () => goTo(-1),
  });
  useShortcut({
    id: "review-nav-enter",
    keys: "Enter",
    display: "Enter",
    description: "Next task",
    scope: "Review navigation",
    handler: () => goTo(1),
  });

  /** Fires a decision optimistically: the task disappears from the visible queue and the
   *  pointer advances to whatever was already next, before the mutation resolves
   *  (NFR-PERF-8, ≤100ms). On failure, the task is reinstated and the pointer moves back
   *  to it. */
  function commit(task: ReviewTask, run: () => Promise<unknown>, successMessage: string) {
    const nextId = nextIdAfterRemoving(visibleOrder, task.id);
    const durationMs = Date.now() - taskOpenedAtRef.current;

    setDecidingId(task.id);
    setRemovedIds((prev) => new Set(prev).add(task.id));
    setSession((prev) => ({ ...recordDecision(prev, durationMs), currentTaskId: nextId }));

    run()
      .then(() => toast.success(successMessage))
      .catch((err) => {
        setRemovedIds((prev) => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });
        setSession((prev) => ({ ...prev, currentTaskId: task.id }));
        toast.error("Decision failed — task restored to the queue", {
          description: err instanceof Error ? err.message : undefined,
        });
      })
      .finally(() => setDecidingId((id) => (id === task.id ? null : id)));
  }

  function handleSkip() {
    if (!currentTask) return;
    const id = currentTask.id;
    const nextId = nextIdAfterRemoving(visibleOrder, id);
    setSession((prev) => ({
      ...prev,
      skippedIds: [...prev.skippedIds.filter((x) => x !== id), id],
      currentTaskId: nextId,
    }));
  }

  function handleBulk(action: "accept" | "reject") {
    if (!currentTask) return;
    const similar = findSimilarTasks(currentTask, serverTasks);
    const ids = similar.map((t) => t.id);
    if (ids.length === 0) return;
    setRemovedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    bulkMutation.mutate(
      { taskIds: ids, action },
      {
        onSuccess: (result) =>
          toast.success(`Bulk ${action}: ${result.applied} applied, ${result.skipped} skipped`),
        onError: (err) => {
          setRemovedIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => next.delete(id));
            return next;
          });
          toast.error("Bulk action failed", {
            description: err instanceof Error ? err.message : undefined,
          });
        },
      },
    );
  }

  const local = computeLocalThroughput(session);
  const totalForTab =
    reasonCode === "ALL" ? (counts.data?.totalOpen ?? 0) : (counts.data?.counts[reasonCode] ?? 0);
  const etaHours =
    local.ratePerHour > 0 && totalForTab > 0 ? totalForTab / local.ratePerHour : null;
  const similarTaskCount = currentTask ? findSimilarTasks(currentTask, serverTasks).length : 0;
  const isDecidingCurrent = decidingId !== null && decidingId === currentTask?.id;

  return (
    <>
      <PageHeader
        title="Review Queue"
        description="The throughput engine — reason-code tabs, keyboard-first decisions."
        eyebrow="Human review workspace"
        actions={
          // The Stitch review screen pins two readouts to the header. Both are already
          // computed for the queue itself — the open count from `GET /review/tasks/counts`
          // and the session rate from `computeLocalThroughput` — so this is a second
          // rendering of existing numbers, not a second source of truth.
          <div className="border-border divide-border flex divide-x rounded-sm border">
            <div className="px-3 py-1.5">
              <div className="label-caps text-muted-foreground">Queue remaining</div>
              <div className="metric text-foreground text-xl leading-tight font-bold">
                {counts.data ? totalForTab : "—"}
              </div>
            </div>
            <div className="px-3 py-1.5">
              <div className="label-caps text-muted-foreground">Session rate</div>
              <div className="metric text-foreground text-xl leading-tight font-bold">
                {local.ratePerHour > 0 ? `${local.ratePerHour.toFixed(1)}/hr` : "—"}
              </div>
            </div>
          </div>
        }
      />
      <PageContainer className="flex flex-col gap-4">
        {counts.status === "error" ? (
          <ErrorState error={counts.error} onRetry={() => counts.refetch()} />
        ) : (
          <QueueSidebar
            counts={counts.data}
            selected={reasonCode}
            onSelect={selectReasonCode}
            etaHours={etaHours}
            loading={counts.status === "pending"}
          />
        )}

        {isMobile ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Review is a desktop workflow"
            description="The keyboard-first decision flow needs a larger screen and a physical keyboard — open this page on a laptop or desktop to review tasks. Dashboard and Catalog work fine here (docs/06-frontend.md §9)."
          />
        ) : tasksQuery.status === "pending" || (stillResolvingDeepLink && !deepLinkNotFound) ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
            <LoadingCard />
            <LoadingBlock rows={6} />
          </div>
        ) : tasksQuery.status === "error" ? (
          <ErrorState error={tasksQuery.error} onRetry={() => tasksQuery.refetch()} />
        ) : deepLinkNotFound ? (
          <EmptyState
            icon={SearchX}
            title="This task is no longer open"
            description="It may already have been resolved. Pick another task from the queue below."
          />
        ) : !currentTask ? (
          <EmptyState
            icon={Inbox}
            title={reasonCode === "ALL" ? "Queue clear" : "No open tasks in this reason code"}
            description="Nothing waiting on a decision right now — check back after the next enrichment run, or pick a different reason code."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
            <div className="flex flex-col gap-3">
              <TaskCard
                task={currentTask}
                position={effectiveIndex + 1}
                total={totalForTab || visibleOrder.length}
              />
              <DecisionBar
                task={currentTask}
                similarTaskCount={similarTaskCount}
                disabled={isDecidingCurrent}
                activeDialog={activeDialog}
                onActiveDialogChange={setActiveDialog}
                onAccept={() =>
                  commit(currentTask, () => acceptMutation.mutateAsync(currentTask.id), "Accepted")
                }
                onApprove={() =>
                  commit(
                    currentTask,
                    () => approveMutation.mutateAsync(currentTask.id),
                    "Approved (Tier 0)",
                  )
                }
                onReject={(reason: UnknownReason) =>
                  commit(
                    currentTask,
                    () => rejectMutation.mutateAsync({ taskId: currentTask.id, reason }),
                    "Rejected → Unknown",
                  )
                }
                onUnknown={(reason: UnknownReason) =>
                  commit(
                    currentTask,
                    () => rejectMutation.mutateAsync({ taskId: currentTask.id, reason }),
                    "Marked Unknown",
                  )
                }
                onCorrect={(value, reason) =>
                  commit(
                    currentTask,
                    () => correctMutation.mutateAsync({ taskId: currentTask.id, value, reason }),
                    "Correction saved",
                  )
                }
                onSkip={handleSkip}
                onBulk={handleBulk}
              />
              <ThroughputMeter
                resolvedCount={local.resolvedCount}
                ratePerHour={local.ratePerHour}
                medianDecisionMs={local.medianDecisionMs}
                baselinePerHour={sessionStats.data?.baselinePerHour ?? 7}
              />
            </div>

            <div className="min-h-[320px] lg:sticky lg:top-4">
              {currentTask.documentVersionId ? (
                <DocumentViewer
                  documentVersionId={currentTask.documentVersionId}
                  initialPage={currentTask.page ?? 1}
                  highlights={
                    currentTask.proposedValue && currentTask.proposedValue.status !== "UNKNOWN"
                      ? currentTask.proposedValue.evidence.map((e) => ({
                          id: e.regionId,
                          page: e.page,
                          bbox: e.bbox,
                          label: e.snippetText,
                          kind: "primary" as const,
                        }))
                      : []
                  }
                  title={currentTask.attributeName}
                  className="h-full"
                />
              ) : (
                <div className="border-border bg-card h-full rounded-sm border">
                  <EmptyState
                    title="No source document"
                    description="This task has no bound document — that is itself the reason it needs review."
                    className="h-full justify-center"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </PageContainer>
    </>
  );
}
