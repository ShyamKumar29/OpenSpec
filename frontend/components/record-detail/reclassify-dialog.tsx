"use client";

/** `PATCH /records/{id}/class` — manual reclassification, writes `HUMAN` provenance
 *  (docs/api.md §Records). A destructive-ish, hard-to-reconcile action (it changes
 *  which schema every attribute is judged against), so it gets its own confirming
 *  dialog rather than a one-click action in the header. */
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATALOG_CLASS_OPTIONS } from "@/lib/catalog/class-options";
import { useReclassifyMutation } from "@/lib/queries/records";

export function ReclassifyDialog({
  recordId,
  currentClassCode,
}: {
  recordId: string;
  currentClassCode: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [classCode, setClassCode] = useState(currentClassCode ?? CATALOG_CLASS_OPTIONS[0].code);
  const mutation = useReclassifyMutation(recordId);

  function submit() {
    mutation.mutate(classCode, {
      onSuccess: () => {
        toast.success("Reclassified", {
          description: "The taxonomy class was updated with HUMAN provenance.",
        });
        setOpen(false);
      },
      onError: (error) => {
        toast.error("Reclassification failed", {
          description: error instanceof Error ? error.message : undefined,
        });
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Reclassify</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reclassify record</DialogTitle>
          <DialogDescription>
            Manually assigning a class writes a `HUMAN` provenance classification and re-evaluates
            every attribute against the new schema.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reclassify-class">Taxonomy class</Label>
          <Select value={classCode} onValueChange={(value) => value && setClassCode(value)}>
            <SelectTrigger id="reclassify-class" className="w-full">
              <SelectValue>
                {(value: string) =>
                  CATALOG_CLASS_OPTIONS.find((o) => o.code === value)?.name ?? value
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CATALOG_CLASS_OPTIONS.map((option) => (
                <SelectItem key={option.code} value={option.code}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save classification"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
