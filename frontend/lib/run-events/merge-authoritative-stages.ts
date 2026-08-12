/**
 * Merges a run's *persisted* stage state (`GET /runs/{id}`) with the state the live
 * narration has replayed so far (`useRunStream`).
 *
 * Why this exists: `useRunStream` deliberately starts every stage at `pending` and
 * narrates forward, because that is what makes Judge Mode and `/runs/:id` feel live
 * (docs/06-frontend.md §3.4). On a *glance* surface like the dashboard's run overview,
 * though, that opening frame is a lie — the pipeline has genuinely completed four stages
 * already, and the database says so. Showing "all pending" for the first second of every
 * page load misreports real state.
 *
 * So: the persisted execution is the floor, the streamed one takes over the moment it
 * has anything to add. Pure, no React — the stage-state equivalent of `merge-notes.ts`.
 */
import { STAGE_CODES, type StageCode, type StageExecution } from "@/lib/contracts/run";

/** Ordering used to decide which of two executions is "further along". `error` sorts
 *  highest so a failure the stream has already reported is never masked by a stale
 *  `running` snapshot fetched before it failed. */
const PROGRESS_RANK: Record<StageExecution["state"], number> = {
  pending: 0,
  skipped: 1,
  running: 2,
  done: 3,
  error: 4,
};

/**
 * @param streamed  the reducer's stage map — authoritative once narration has started
 * @param persisted the run's own `stages` array from `GET /runs/{id}`, or `undefined`
 *                  while that query is still in flight
 */
export function mergeAuthoritativeStages(
  streamed: Record<StageCode, StageExecution>,
  persisted: StageExecution[] | undefined,
): Record<StageCode, StageExecution> {
  if (!persisted || persisted.length === 0) return streamed;

  const byCode = new Map(persisted.map((s) => [s.stage, s]));
  const merged = {} as Record<StageCode, StageExecution>;

  for (const code of STAGE_CODES) {
    const live = streamed[code];
    const stored = byCode.get(code);
    if (!stored) {
      merged[code] = live;
      continue;
    }
    merged[code] = PROGRESS_RANK[live.state] >= PROGRESS_RANK[stored.state] ? live : stored;
  }

  return merged;
}
