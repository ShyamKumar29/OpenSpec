"use client";

/**
 * The enrichment engine's live activity console — the centre pane of the Stitch Judge
 * Mode screen ("ENRICHMENT ENGINE ACTIVE" over a streaming data log).
 *
 * Two rules shape everything here:
 *
 * 1. **The run drives the motion.** There is no independent animation timer producing
 *    invented progress. The transcript comes from `useEngineLog`, which projects the
 *    authoritative reducer state (`useRunStream`) into lines; the only timer in this file
 *    is a *reveal cursor* that walks lines the run has already produced. When the run
 *    stops producing lines, the cursor catches up and stops. It cannot run ahead of the
 *    pipeline, and it cannot keep "processing" after the run has settled — there is
 *    nothing left for it to reveal.
 *
 * 2. **The text stays text.** Real DOM nodes, normal selection, no canvas, no
 *    `user-select` override, no keystroke interception. Hovering — or focusing — the log
 *    pauses the reveal *in place* (never restarting it) so a judge can read, select, and
 *    copy what is on screen while the pipeline keeps running underneath.
 *
 * Under `prefers-reduced-motion: reduce` the reveal is skipped entirely: every line the
 * run has produced is shown immediately, and the caret/scan decorations are disabled in
 * CSS. Reduced motion removes movement, never information.
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { useEngineLog } from "@/lib/run-events/use-engine-log";
import type { EngineLogLine, EngineLogSnapshotInput } from "@/lib/run-events/engine-log";

/** Reveal cadence. One interval, only while there is something left to reveal. */
const TICK_MS = 40;
/** Characters per tick when the console is keeping pace with the pipeline. */
const BASE_CHARS_PER_TICK = 2;
/** Extra characters per tick for each line of backlog — the console types faster when it
 *  has fallen behind (a burst of stage events, or a resume after a long hover) so that it
 *  converges on the run instead of trailing it. Speed is a function of the real backlog,
 *  which is what keeps the motion honest. */
const CATCHUP_CHARS_PER_LINE = 6;
const MAX_CHARS_PER_TICK = 96;

/** Pinned to the dark-surface end of the status palette because this console is always
 *  on the near-black chrome ground in both themes — the same decision, and the same three
 *  values, as `components/shell/pipeline-strip.tsx`. Tone is never the only signal: every
 *  line also carries its gutter label and a word ("DONE", "ERROR", "SKIPPED"). */
const TONE_CLASS: Record<EngineLogLine["tone"], string> = {
  input: "text-chrome-foreground/70",
  start: "text-chrome-foreground",
  progress: "text-chrome-foreground/75",
  done: "text-[#79d18b]",
  note: "text-[#e5b165]",
  result: "text-[#79d18b]",
  error: "text-[#f09a92]",
};

export interface EngineConsoleProps extends EngineLogSnapshotInput {
  /** True while the run is genuinely in flight — gates the decorative scan/caret motion
   *  so nothing keeps moving after the run has completed, failed, or been cancelled. */
  active: boolean;
  className?: string;
}

export function EngineConsole({ active, className, ...snapshot }: EngineConsoleProps) {
  const lines = useEngineLog(snapshot);
  return <ConsoleStream lines={lines} active={active} className={className} />;
}

function ConsoleStream({
  lines,
  active,
  className,
}: {
  lines: EngineLogLine[];
  active: boolean;
  className?: string;
}) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [cursor, setCursor] = useState({ line: 0, chars: 0 });
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const paused = hovered || focused;

  // Reduced motion is applied as a *derivation*, not as state: everything the run has
  // produced is simply already revealed. Nothing to store, nothing to synchronise, and no
  // reveal interval is ever started below.
  const shownLines = reducedMotion ? lines.length : cursor.line;
  const caughtUp = shownLines >= lines.length;

  useEffect(() => {
    if (reducedMotion || paused || caughtUp) return;
    const id = setInterval(() => {
      setCursor((prev) => {
        const line = lines[prev.line];
        if (!line) return prev;
        const backlog = lines.length - prev.line;
        const speed = Math.min(
          BASE_CHARS_PER_TICK + Math.max(0, backlog - 1) * CATCHUP_CHARS_PER_LINE,
          MAX_CHARS_PER_TICK,
        );
        const chars = prev.chars + speed;
        return chars >= line.text.length ? { line: prev.line + 1, chars: 0 } : { ...prev, chars };
      });
    }, TICK_MS);
    return () => clearInterval(id);
    // `cursor.chars` is deliberately absent: it changes on every tick and would otherwise
    // tear down and rebuild the interval 25 times a second.
  }, [lines, cursor.line, paused, caughtUp, reducedMotion]);

  // Follow the tail — but never while the pointer or focus is in the log, which is the
  // whole point of pausing: content must not move under a selection.
  useEffect(() => {
    if (paused) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [cursor, lines.length, paused]);

  const revealed = useMemo(() => lines.slice(0, shownLines), [lines, shownLines]);
  const typing = caughtUp ? null : lines[shownLines];

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div
        ref={scrollRef}
        data-testid="engine-console"
        data-paused={paused ? "true" : "false"}
        tabIndex={0}
        role="log"
        // Not a live region: the log ticks several times a second while a stage runs,
        // which would be constant screen-reader chatter. The announcement that matters is
        // the terminal outcome, which `LiveResultPanel` carries with `aria-live="polite"`.
        aria-live="off"
        aria-label="Enrichment engine activity log"
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="bg-chrome text-chrome-foreground focus-visible:ring-chrome-foreground/60 relative min-h-0 flex-1 overflow-y-auto p-3 focus-visible:ring-1 focus-visible:outline-none"
      >
        {/* Decorative only, and only while the run is genuinely active: the Stitch
            screen's targeting reticle and scan sweep, behind the text. `aria-hidden`,
            pointer-events-none, and silenced by CSS under reduced motion. */}
        {active ? <EngineBackdrop paused={paused} /> : null}

        <ol className="metric relative flex flex-col gap-0.5 text-[12px] leading-[1.45]">
          <RevealedLines lines={revealed} />
          {typing ? (
            <LogLine line={typing} text={typing.text.slice(0, cursor.chars)} caret />
          ) : null}
          {lines.length === 0 ? (
            <li className="text-chrome-foreground/60">Awaiting the first stage event…</li>
          ) : null}
        </ol>
      </div>

      <div className="border-chrome-border bg-chrome text-chrome-foreground/60 flex items-center justify-between gap-2 border-t px-3 py-1.5">
        <span className="label-caps label-caps-sm flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 rounded-full",
              paused
                ? "bg-[#e5b165]"
                : active
                  ? "os-engine-pulse bg-[#79d18b]"
                  : "bg-chrome-foreground/35",
            )}
          />
          {paused ? "Paused" : active ? "Streaming" : "Idle"}
        </span>
        <span className="metric text-[10px]">
          {revealed.length + (typing ? 1 : 0)}/{lines.length} lines
        </span>
        <span className="sr-only">
          Moving the pointer over this log, or focusing it, pauses the reveal so its text can be
          read, selected, and copied. The reveal resumes where it left off.
        </span>
      </div>
    </div>
  );
}

/** Already-revealed lines never change again, so they are memoised away from the reveal
 *  cursor's ticks — only the single line currently being typed re-renders (NFR: no
 *  whole-page re-render per animation frame). */
const RevealedLines = memo(function RevealedLines({ lines }: { lines: EngineLogLine[] }) {
  return (
    <>
      {lines.map((line) => (
        <LogLine key={line.key} line={line} text={line.text} />
      ))}
    </>
  );
});

function LogLine({
  line,
  text,
  caret = false,
}: {
  line: EngineLogLine;
  text: string;
  caret?: boolean;
}) {
  return (
    <li className="flex min-w-0 gap-2">
      {/* `/60`, not lower: the gutter is meant to read as quiet, but this is 12px text on
          the near-black console ground and anything dimmer falls under 4.5:1 (NFR-ACC-4). */}
      <span className="text-chrome-foreground/60 w-10 shrink-0 tabular-nums">{line.label}</span>
      <span className={cn("min-w-0 break-words whitespace-pre-wrap", TONE_CLASS[line.tone])}>
        {text}
        {caret ? (
          <span aria-hidden="true" className="os-caret text-chrome-foreground/80">
            ▍
          </span>
        ) : null}
      </span>
    </li>
  );
}

/** The Stitch centre-pane decoration: a slowly rotating crosshair reticle with a scan
 *  sweep. Purely presentational — it carries no information, so it is `aria-hidden`, it
 *  only exists while the run is active, and it holds still while the log is paused. */
function EngineBackdrop({ paused }: { paused: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={cn(
            "border-chrome-foreground/10 relative size-48 rounded-full border",
            !paused && "os-reticle",
          )}
        >
          <div className="bg-chrome-foreground/10 absolute top-1/2 h-px w-full" />
          <div className="bg-chrome-foreground/10 absolute left-1/2 h-full w-px" />
        </div>
      </div>
      {!paused ? (
        <div className="via-chrome-foreground/12 os-scanline absolute inset-x-0 h-24 bg-gradient-to-b from-transparent to-transparent" />
      ) : null}
    </div>
  );
}
