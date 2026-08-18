"use client";

/**
 * Turns the reducer's successive run-state snapshots into the engine console's
 * append-only transcript (`engine-log.ts`).
 *
 * This is *not* a second event system (F4's architecture is fixed: one `RunEventSource`,
 * one reducer, one `useRunStream`). It holds no timer, opens no connection, and asks for
 * nothing the page did not already have — it only remembers what the authoritative state
 * has already said, because the reducer deliberately keeps just the current execution per
 * stage and a transcript needs the history.
 *
 * Reset is by remount: callers key the console component on the run id + attempt, so a
 * re-run starts a clean transcript with no reset logic to get wrong.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  engineLogSnapshot,
  selectUnseenLines,
  type EngineLogLine,
  type EngineLogSnapshotInput,
} from "./engine-log";

export function useEngineLog(input: EngineLogSnapshotInput): EngineLogLine[] {
  const [transcript, setTranscript] = useState<EngineLogLine[]>([]);
  const seen = useRef<Set<string>>(new Set());

  const { ctx, phase, stages, notes, totals, costSoFar } = input;

  // Memoised on the run state itself, so the console's own reveal ticks (which re-render
  // this component many times a second) never recompute the snapshot.
  const snapshot = useMemo(
    () => engineLogSnapshot({ ctx, phase, stages, notes, totals, costSoFar }),
    [ctx, phase, stages, notes, totals, costSoFar],
  );

  useEffect(() => {
    const fresh = selectUnseenLines(snapshot, seen.current);
    if (fresh.length === 0) return;
    for (const line of fresh) seen.current.add(line.key);
    setTranscript((prev) => [...prev, ...fresh]);
  }, [snapshot]);

  return transcript;
}
