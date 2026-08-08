"use client";

/** `POST /export` (docs/api.md §Export) — shared by the catalog (exports the current
 *  filtered set) and Record Detail (exports one record). Only the trigger label and the
 *  `filter` payload differ between the two call sites. */
import { useState } from "react";
import { DownloadIcon } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { useExportMutation, useExportTargetsQuery, type ExportPolicy } from "@/lib/queries/export";
import { hasActiveCatalogFilters, type CatalogFilters } from "@/lib/catalog/filters";
import { catalogFiltersToWireQuery } from "@/lib/catalog/filters";

const POLICIES: { value: ExportPolicy; label: string }[] = [
  { value: "auto_accepted_only", label: "Auto-accepted only" },
  { value: "human_approved_only", label: "Human-approved only" },
  { value: "all_with_flags", label: "All values, with flags" },
];

export function ExportDialog({
  triggerElement,
  triggerChildren,
  filter,
  description,
}: {
  /** A props-only element (e.g. `<Button variant="outline" size="sm" />`) — matches the
   *  base-ui `render` merge pattern used throughout components/ui/*.tsx: the element
   *  supplies the rendered tag + its own props, `triggerChildren` supplies content. */
  triggerElement: React.ReactElement;
  triggerChildren: React.ReactNode;
  filter: Record<string, unknown>;
  description: string;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("csv");
  const [policy, setPolicy] = useState<ExportPolicy>("auto_accepted_only");
  const [includeProvenance, setIncludeProvenance] = useState(true);
  const targets = useExportTargetsQuery();
  const mutation = useExportMutation();

  function submit() {
    mutation.mutate(
      { target, filter, includeProvenance, policy },
      {
        onSuccess: (result) => {
          toast.success("Export queued", {
            description: `Export ${result.export_id} is processing.`,
          });
          setOpen(false);
        },
        onError: (error) => {
          toast.error("Export failed", {
            description: error instanceof Error ? error.message : undefined,
          });
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={triggerElement}>{triggerChildren}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="export-target">Target format</Label>
            <Select value={target} onValueChange={(value) => value && setTarget(value)}>
              <SelectTrigger id="export-target" className="w-full">
                <SelectValue>
                  {(value: string) =>
                    targets.data?.targets.find((t) => t.code === value)?.name ?? value
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(targets.data?.targets ?? []).map((t) => (
                  <SelectItem key={t.code} value={t.code}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="export-policy">Export policy</Label>
            <Select value={policy} onValueChange={(v) => v && setPolicy(v as ExportPolicy)}>
              <SelectTrigger id="export-policy" className="w-full">
                <SelectValue>
                  {(value: string) => POLICIES.find((p) => p.value === value)?.label ?? value}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {POLICIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Switch checked={includeProvenance} onCheckedChange={setIncludeProvenance} size="sm" />
            Include provenance columns
          </label>
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? "Queuing…" : "Export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CatalogExportButton({ filters }: { filters: CatalogFilters }) {
  return (
    <ExportDialog
      triggerElement={<Button variant="outline" size="sm" />}
      triggerChildren={
        <>
          <DownloadIcon aria-hidden="true" />
          Export
        </>
      }
      filter={catalogFiltersToWireQuery(filters)}
      description={
        hasActiveCatalogFilters(filters)
          ? "Export the records matching the current catalog filters."
          : "Export the full catalog."
      }
    />
  );
}
