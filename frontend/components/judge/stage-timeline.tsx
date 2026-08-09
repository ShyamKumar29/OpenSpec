import { STAGE_CODES, type StageCode, type StageExecution } from "@/lib/contracts/run";
import { mergeStageNotes } from "@/lib/run-events/merge-notes";
import { StageRow } from "./stage-row";

/**
 * The pipeline timeline — CLS · SCH · DOC · PRS · EXT · VER · VAL · NRM · CNF, in that
 * order always (docs/06-frontend.md §3.4). Shared verbatim between Judge Mode and
 * `/runs/:id` (docs/14-frontend-implementation-plan.md §6 F4: "Reused by `/runs/:id`").
 * Pure presentation — all the "what happened" logic lives in `lib/run-events`.
 */
export function StageTimeline({
  stages,
  notesSource,
}: {
  stages: Record<StageCode, StageExecution>;
  /** Static per-stage narration, from a `GET /runs/{id}` fetch — the live SSE stream
   *  itself carries no `note` field (docs/api.md §Runs & progress's SSE event shape). */
  notesSource?: StageExecution[] | null;
}) {
  const display = mergeStageNotes(stages, notesSource);
  return (
    <ol aria-label="Pipeline stages" className="flex flex-col gap-0.5">
      {STAGE_CODES.map((code) => (
        <StageRow key={code} stage={display[code]} />
      ))}
    </ol>
  );
}
