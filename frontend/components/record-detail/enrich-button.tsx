"use client";

/** `POST /records/{id}/enrich` (docs/api.md §Records) — re-runs the pipeline. Confirmed
 *  first (CLAUDE.md: confirm hard-to-reverse, outward-facing actions) since it queues
 *  real pipeline work against the record. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/state/confirm-dialog";
import { useEnrichMutation } from "@/lib/queries/records";

export function EnrichButton({ recordId }: { recordId: string }) {
  const [open, setOpen] = useState(false);
  const mutation = useEnrichMutation(recordId);
  const router = useRouter();

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <RefreshCwIcon aria-hidden="true" />
        Re-enrich
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Re-run enrichment for this record?"
        description="This queues a fresh pipeline run from ingest through confidence scoring. Existing accepted values are not discarded until the new run verifies a replacement."
        confirmLabel="Re-enrich"
        onConfirm={() =>
          mutation.mutate(
            {},
            {
              onSuccess: (result) => {
                toast.success("Re-enrichment started", {
                  description: `Run ${result.run_id}`,
                  action: {
                    label: "View progress",
                    onClick: () => router.push(`/runs/${result.run_id}`),
                  },
                });
              },
              onError: (error) => {
                toast.error("Could not start re-enrichment", {
                  description: error instanceof Error ? error.message : undefined,
                });
              },
            },
          )
        }
      />
    </>
  );
}
