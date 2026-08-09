"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { isUnknownValue } from "@/lib/contracts/attribute-value";
import type { ReviewTask } from "@/lib/contracts/review";

/**
 * `E` — the free-text edit flow. Submits through `POST /review/tasks/{id}/correct`
 * (docs/api.md §Review), which writes a `HUMAN`-provenance value that supersedes the
 * proposed one (INV-5: provenance is never upgraded — `HUMAN` is a separate, terminal
 * kind, not a promotion of `EXTRACTED`).
 */
export function EditValueDialog({
  open,
  onOpenChange,
  task,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: ReviewTask;
  onSubmit: (value: string, reason: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Mounted only while open (why-panel.tsx's convention) — a fresh mount is how
         *  the form's local state resets per task, with no reset effect required. */}
        {open ? (
          <EditValueForm task={task} onCancel={() => onOpenChange(false)} onSubmit={onSubmit} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EditValueForm({
  task,
  onCancel,
  onSubmit,
}: {
  task: ReviewTask;
  onCancel: () => void;
  onSubmit: (value: string, reason: string) => void;
}) {
  const asserted =
    task.proposedValue && !isUnknownValue(task.proposedValue) ? task.proposedValue : null;
  const [value, setValue] = useState(asserted?.valueDisplay ?? "");
  const [reason, setReason] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed, reason.trim() || "Reviewer correction");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Edit: {task.attributeName}</DialogTitle>
        <DialogDescription>
          Supersedes the proposed value with a correction you supply directly — recorded as `HUMAN`
          provenance.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-value-input">Value</Label>
        <Input
          id="edit-value-input"
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-reason-input">Reason (optional)</Label>
        <Textarea
          id="edit-reason-input"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why this value is correct"
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!value.trim()}>
          Save correction
        </Button>
      </DialogFooter>
    </form>
  );
}
