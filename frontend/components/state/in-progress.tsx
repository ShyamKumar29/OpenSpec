import { Construction } from "lucide-react";
import { EmptyState } from "./empty-state";

/**
 * The honest placeholder for a route that exists and is navigable but whose real
 * content lands in a later phase (docs/14-frontend-implementation-plan.md §F0: "others
 * get honest 'in progress' states, never a blank page"). Never used for a page this
 * phase actually owns.
 */
export function InProgressState({ phase, note }: { phase: string; note?: string }) {
  return (
    <EmptyState
      icon={Construction}
      title={`Built in ${phase}`}
      description={
        note ??
        "This route exists and is navigable now. Its real content lands in a later phase of the frontend implementation plan."
      }
    />
  );
}
