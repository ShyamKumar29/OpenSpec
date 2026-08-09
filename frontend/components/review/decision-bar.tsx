"use client";

import { Button } from "@/components/ui/button";
import { useShortcut } from "@/lib/keyboard/registry";
import { isUnknownValue, type UnknownReason } from "@/lib/contracts/attribute-value";
import type { ReviewTask } from "@/lib/contracts/review";
import { unknownReasonForTask } from "@/lib/review/reason-mapping";
import { EditValueDialog } from "./edit-value-dialog";
import { ReattachEvidenceDialog } from "./reattach-evidence-dialog";
import { BulkDialog } from "./bulk-dialog";

/**
 * The decision bar (docs/06-frontend.md §3.3): `[A] Accept proposed [R] Reject → Unknown
 * [E] Edit value [D] Reattach [S] Skip [B] Bulk`. Every action is both a labelled button
 * (mouse/screen-reader reachable) and a registered shortcut (keyboard-reachable) — the
 * same requirement satisfies NFR-ACC-2 and the throughput goal at once
 * (docs/06-frontend.md §1: "the accessibility requirement and the throughput requirement
 * are the same requirement").
 *
 * Handlers call the mutation-firing callbacks synchronously and return immediately —
 * they never `await` the network (NFR-PERF-8). Optimistic bookkeeping (removing the task
 * from the on-screen queue, rollback on failure) lives in the caller (`ReviewQueueView`),
 * not here; this component only decides *which* action is currently constructible for
 * this task and dispatches it.
 */
export type ReviewDialogKind = "edit" | "reattach" | "bulk" | null;

export function DecisionBar({
  task,
  similarTaskCount,
  disabled,
  activeDialog,
  onActiveDialogChange,
  onAccept,
  onApprove,
  onReject,
  onUnknown,
  onCorrect,
  onSkip,
  onBulk,
}: {
  task: ReviewTask;
  similarTaskCount: number;
  /** True while a decision for *this* task is already in flight — guards against a
   *  double keypress firing two mutations for the same task. */
  disabled?: boolean;
  /** Owned by `ReviewQueueView`, not locally — the queue's `J`/`K`/`Enter` navigation
   *  shortcuts need to know a dialog is open too (Enter inside a dialog button is not a
   *  typing target, so the registry's "skip while typing" guard alone can't stop the
   *  queue's own Enter-advances-to-next-task binding from also firing underneath it). */
  activeDialog: ReviewDialogKind;
  onActiveDialogChange: (dialog: ReviewDialogKind) => void;
  onAccept: () => void;
  onApprove: () => void;
  onReject: (reason: UnknownReason) => void;
  onUnknown: (reason: UnknownReason) => void;
  onCorrect: (value: string, reason: string) => void;
  onSkip: () => void;
  onBulk: (action: "accept" | "reject") => void;
}) {
  const hasProposedValue = task.proposedValue !== null && !isUnknownValue(task.proposedValue);
  const isTier0 = task.riskTier === 0;
  const canReattach = task.documentVersionId !== null;
  const canBulk = similarTaskCount > 0;

  // A dialog owns the keyboard while it's open (its own input, its own Enter/Escape) —
  // every decision-bar shortcut is a no-op until it closes, so e.g. typing in the Edit
  // dialog's value field can never be interpreted as "R" rejecting the task underneath it.
  const guarded = (fn: () => void) => () => {
    if (activeDialog !== null || disabled) return;
    fn();
  };

  useShortcut({
    id: "review-primary",
    keys: "a",
    display: "A",
    description: isTier0 ? "Approve (Tier 0)" : "Accept proposed value",
    scope: "Review decisions",
    handler: guarded(() => (isTier0 ? onApprove() : onAccept())),
  });

  useShortcut({
    id: "review-reject",
    keys: "r",
    display: "R",
    description: "Reject proposed value → Unknown",
    scope: "Review decisions",
    handler: guarded(() => {
      if (hasProposedValue) onReject(unknownReasonForTask(task.reasonCode));
    }),
  });

  useShortcut({
    id: "review-unknown",
    keys: "u",
    display: "U",
    description: "Assert Unknown directly",
    scope: "Review decisions",
    handler: guarded(() => {
      if (!hasProposedValue) onUnknown(unknownReasonForTask(task.reasonCode));
    }),
  });

  useShortcut({
    id: "review-edit",
    keys: "e",
    display: "E",
    description: "Edit value",
    scope: "Review decisions",
    handler: guarded(() => onActiveDialogChange("edit")),
  });

  useShortcut({
    id: "review-reattach",
    keys: "d",
    display: "D",
    description: "Reattach evidence",
    scope: "Review decisions",
    handler: guarded(() => {
      if (canReattach) onActiveDialogChange("reattach");
    }),
  });

  useShortcut({
    id: "review-skip",
    keys: "s",
    display: "S",
    description: "Skip (leaves task open)",
    scope: "Review decisions",
    handler: guarded(onSkip),
  });

  useShortcut({
    id: "review-bulk",
    keys: "b",
    display: "B",
    description: "Bulk: apply to similar tasks in this document",
    scope: "Review decisions",
    handler: guarded(() => {
      if (canBulk) onActiveDialogChange("bulk");
    }),
  });

  return (
    <div
      data-testid="decision-bar"
      className="border-border bg-card flex flex-wrap items-center gap-2 rounded-lg border p-2.5"
    >
      <Button
        size="sm"
        disabled={disabled}
        onClick={guarded(() => (isTier0 ? onApprove() : onAccept()))}
        data-testid="decision-accept"
      >
        [A] {isTier0 ? "Approve" : "Accept"}
      </Button>

      {hasProposedValue ? (
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={guarded(() => onReject(unknownReasonForTask(task.reasonCode)))}
        >
          [R] Reject → Unknown
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={guarded(() => onUnknown(unknownReasonForTask(task.reasonCode)))}
        >
          [U] Mark Unknown
        </Button>
      )}

      <Button
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={guarded(() => onActiveDialogChange("edit"))}
      >
        [E] Edit value
      </Button>

      <Button
        size="sm"
        variant="outline"
        disabled={disabled || !canReattach}
        onClick={guarded(() => onActiveDialogChange("reattach"))}
        title={canReattach ? undefined : "No source document to reattach evidence from"}
      >
        [D] Reattach
      </Button>

      <Button size="sm" variant="ghost" disabled={disabled} onClick={guarded(onSkip)}>
        [S] Skip
      </Button>

      <Button
        size="sm"
        variant="ghost"
        disabled={disabled || !canBulk}
        onClick={guarded(() => onActiveDialogChange("bulk"))}
        title={canBulk ? undefined : "No other open tasks share this document and attribute"}
      >
        [B] Bulk{canBulk ? ` (${similarTaskCount})` : ""}
      </Button>

      <EditValueDialog
        open={activeDialog === "edit"}
        onOpenChange={(open) => onActiveDialogChange(open ? "edit" : null)}
        task={task}
        onSubmit={(value, reason) => {
          onActiveDialogChange(null);
          onCorrect(value, reason);
        }}
      />
      <ReattachEvidenceDialog
        open={activeDialog === "reattach"}
        onOpenChange={(open) => onActiveDialogChange(open ? "reattach" : null)}
        task={task}
        onSubmit={(value, reason) => {
          onActiveDialogChange(null);
          onCorrect(value, reason);
        }}
      />
      <BulkDialog
        open={activeDialog === "bulk"}
        onOpenChange={(open) => onActiveDialogChange(open ? "bulk" : null)}
        similarTaskCount={similarTaskCount}
        onConfirm={(action) => {
          onActiveDialogChange(null);
          onBulk(action);
        }}
      />
    </div>
  );
}
