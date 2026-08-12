import { describe, expect, it } from "vitest";
import { frontierDomain, plotFrontier } from "./frontier-geometry";

const POINTS = [
  { label: "OpenSpec (verified)", costUsdPerSku: 0.024, precision: 0.982, isBaseline: false },
  { label: "Generic LLM, no abstention", costUsdPerSku: 0.018, precision: 0.834, isBaseline: true },
  { label: "OpenSpec, cached", costUsdPerSku: 0.006, precision: 0.981, isBaseline: false },
];

describe("frontierDomain", () => {
  it("floors yMin below the lowest precision rather than always starting at 0 — the gap is the point", () => {
    const domain = frontierDomain(POINTS);
    expect(domain.yMin).toBeCloseTo(0.75, 5); // floor(0.834*20)/20 - 0.05 = 0.80 - 0.05
    expect(domain.yMax).toBe(1);
  });

  it("gives the x-axis 25% headroom past the most expensive point", () => {
    const domain = frontierDomain(POINTS);
    expect(domain.xMax).toBeCloseTo(0.03, 5);
  });

  it("degrades gracefully for an empty point set instead of dividing by zero", () => {
    expect(frontierDomain([])).toEqual({ xMax: 0.01, yMin: 0, yMax: 1 });
  });
});

describe("plotFrontier", () => {
  it("places every point within the chart's padded viewBox", () => {
    const plotted = plotFrontier(POINTS, 300, 160, 28);
    for (const p of plotted) {
      expect(p.px).toBeGreaterThanOrEqual(28);
      expect(p.px).toBeLessThanOrEqual(300 - 28 + 0.01);
      expect(p.py).toBeGreaterThanOrEqual(28 - 0.01);
      expect(p.py).toBeLessThanOrEqual(160 - 28 + 0.01);
    }
  });

  it("plots the higher-precision point above (smaller py than) the lower-precision baseline", () => {
    const plotted = plotFrontier(POINTS, 300, 160, 28);
    const verified = plotted.find((p) => p.label === "OpenSpec (verified)")!;
    const baseline = plotted.find((p) => p.isBaseline)!;
    expect(verified.py).toBeLessThan(baseline.py);
  });

  it("returns an empty array for an empty point set", () => {
    expect(plotFrontier([], 300, 160)).toEqual([]);
  });
});
