"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * `B` — bulk apply to similar tasks (docs/06-frontend.md §3.3: "[B] Bulk: apply to 14
 * similar tasks in this document"). `POST /review/bulk` returns a confirmation summary
 * (docs/api.md §Review); this dialog is the *pre*-confirmation — bulk decisions affect
 * many tasks at once, so unlike the single-task decisions it is not fired directly from
 * the keyboard without a stop.
 */
export function BulkDialog({
  open,
  onOpenChange,
  similarTaskCount,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  similarTaskCount: number;
  onConfirm: (action: "accept" | "reject") => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Bulk apply to {similarTaskCount} similar task{similarTaskCount === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            Same reason code, attribute, and source document as the task you&apos;re on. Tier 0
            attributes among them are skipped, never bulk-accepted (INV-9) — resolve those
            individually with Approve.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="outline" onClick={() => onConfirm("reject")}>
            Reject all → Unknown
          </Button>
          <Button type="button" onClick={() => onConfirm("accept")}>
            Accept all
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
