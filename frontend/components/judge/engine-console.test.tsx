import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { EngineConsole } from "./engine-console";
import { initialStages } from "@/lib/run-events/reducer";
import type { StageCode, StageExecution } from "@/lib/contracts/run";

const TOTALS = { liveExtracted: 0, liveUnknown: 0, liveRejected: 0 };
const CTX = { runId: "judge_run_success", mpn: "ABC-123", description: "1/2 BRS BALL VLV 600WOG" };

function stagesWith(overrides: Partial<Record<StageCode, Partial<StageExecution>>>) {
  const stages = initialStages();
  for (const [code, patch] of Object.entries(overrides) as [StageCode, Partial<StageExecution>][]) {
    stages[code] = { ...stages[code], ...patch };
  }
  return stages;
}

function renderConsole(stages = stagesWith({ CLS: { state: "running" } }), active = true) {
  return render(
    <EngineConsole
      active={active}
      ctx={CTX}
      phase={active ? "running" : "completed"}
      stages={stages}
      totals={TOTALS}
      costSoFar={0}
    />,
  );
}

/** The caret is a decoration, not content — ignore it when comparing revealed text. */
function visibleText(el: HTMLElement): string {
  return (el.textContent ?? "").replaceAll("▍", "");
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("EngineConsole", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reveals the run's own narration progressively, never all at once", () => {
    renderConsole();
    const log = screen.getByTestId("engine-console");

    advance(120);
    const early = visibleText(log);
    advance(4000);
    const later = visibleText(log);

    expect(later.length).toBeGreaterThan(early.length);
    expect(later).toContain("judge_run_success");
    expect(later).toContain("CLASSIFYING");
  });

  it("never narrates a stage the run has not reached", () => {
    renderConsole(stagesWith({ CLS: { state: "running" } }));
    advance(8000);
    expect(visibleText(screen.getByTestId("engine-console"))).not.toContain("EXTRACTING");
  });

  it("pauses on hover and resumes from where it stopped, never from the beginning", () => {
    renderConsole();
    const log = screen.getByTestId("engine-console");
    advance(600);

    fireEvent.pointerEnter(log);
    expect(log).toHaveAttribute("data-paused", "true");
    const atPause = visibleText(log);

    advance(5000);
    expect(visibleText(log)).toBe(atPause);

    fireEvent.pointerLeave(log);
    expect(log).toHaveAttribute("data-paused", "false");
    advance(1200);

    const afterResume = visibleText(log);
    expect(afterResume.length).toBeGreaterThan(atPause.length);
    // Resumed, not restarted: everything that was on screen is still on screen, in order.
    expect(afterResume.startsWith(atPause)).toBe(true);
  });

  it("pauses on keyboard focus too, so the pause is not mouse-only", () => {
    renderConsole();
    const log = screen.getByTestId("engine-console");
    advance(600);

    expect(log).toHaveAttribute("tabindex", "0");
    fireEvent.focus(log);
    expect(log).toHaveAttribute("data-paused", "true");
    const atPause = visibleText(log);
    advance(5000);
    expect(visibleText(log)).toBe(atPause);

    fireEvent.blur(log);
    advance(1200);
    expect(visibleText(log).length).toBeGreaterThan(atPause.length);
  });

  it("keeps its content as ordinary selectable DOM text", () => {
    renderConsole();
    advance(4000);
    const log = screen.getByTestId("engine-console");

    // Real text nodes in a list — not a canvas, not an image, nothing that would defeat
    // drag-select or Ctrl+C.
    expect(log.querySelector("canvas")).toBeNull();
    expect(log.querySelectorAll("li").length).toBeGreaterThan(0);
    expect(visibleText(log).trim().length).toBeGreaterThan(0);
    expect(log.className).not.toContain("select-none");
    expect(getComputedStyle(log).userSelect).not.toBe("none");
  });

  it("stops narrating once the run is no longer active", () => {
    renderConsole(stagesWith({ CLS: { state: "done", durationMs: 420, costUsd: 0.002 } }), false);
    advance(6000);
    const settled = visibleText(screen.getByTestId("engine-console"));
    advance(10_000);
    expect(visibleText(screen.getByTestId("engine-console"))).toBe(settled);
    expect(settled).toContain("COMPLETE");
  });
});

describe("EngineConsole under prefers-reduced-motion", () => {
  const realMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.useFakeTimers();
    window.matchMedia = ((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = realMatchMedia;
    vi.useRealTimers();
  });

  it("shows everything the run has reported immediately, with no reveal animation", () => {
    renderConsole(
      stagesWith({
        CLS: { state: "done", durationMs: 420, costUsd: 0.002 },
        SCH: { state: "running" },
      }),
    );
    const log = screen.getByTestId("engine-console");

    // No timer advanced at all — the content is simply present.
    act(() => {
      vi.advanceTimersByTime(0);
    });
    const text = visibleText(log);
    expect(text).toContain("judge_run_success");
    expect(text).toContain("CLASSIFYING");
    expect(text).toContain("RESOLVING_SCHEMA");
    expect(log.querySelector(".os-caret")).toBeNull();
  });
});
