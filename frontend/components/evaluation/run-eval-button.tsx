"use client";

import { PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTriggerEvalRunMutation } from "@/lib/queries/evaluation";

/**
 * `POST /eval/runs` (docs/api.md §Evaluation & dashboard). Honest about what the mock
 * actually does: the harness itself (`make eval`, docs/09-testing.md §6) is a backend/CI
 * concern, so this acknowledges the request rather than pretending a fresh run just
 * appeared in the history table (CLAUDE.md: "Report honestly") — same non-destructive,
 * toast-driven pattern as `components/record-detail/enrich-button.tsx`.
 */
export function RunEvalButton() {
  const mutation = useTriggerEvalRunMutation();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={mutation.isPending}
      onClick={() =>
        mutation.mutate(undefined, {
          onSuccess: (result) => {
            toast.success("Evaluation run acknowledged", {
              description: `The mock API queues the request and returns the latest run (${result.eval_run_id}). The gold-set harness itself runs via 'make eval' (docs/09-testing.md §6).`,
            });
          },
          onError: (error) => {
            toast.error("Could not trigger an evaluation run", {
              description: error instanceof Error ? error.message : undefined,
            });
          },
        })
      }
    >
      <PlayCircle aria-hidden="true" />
      Run evaluation
    </Button>
  );
}
