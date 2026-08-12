import { describe, expect, it } from "vitest";
import { plotSparkline, sparklinePath } from "./sparkline";

describe("plotSparkline", () => {
  it("returns an empty array for no points", () => {
    expect(plotSparkline([], 100, 40)).toEqual([]);
  });

  it("centres a single point", () => {
    const [p] = plotSparkline([{ x: 0, y: 0.5 }], 100, 40);
    expect(p.px).toBe(50);
    expect(p.py).toBe(20);
  });

  it("maps the minimum to the bottom and the maximum to the top, within padding", () => {
    const padding = 8;
    const height = 40;
    const points = plotSparkline(
      [
        { x: 0, y: 0.1 },
        { x: 1, y: 0.9 },
      ],
      100,
      height,
      padding,
    );
    expect(points[0].py).toBeCloseTo(height - padding); // lowest value -> bottom
    expect(points[1].py).toBeCloseTo(padding); // highest value -> top
  });

  it("renders a flat series as a level line through the vertical centre, never NaN", () => {
    const points = plotSparkline(
      [
        { x: 0, y: 0.5 },
        { x: 1, y: 0.5 },
        { x: 2, y: 0.5 },
      ],
      100,
      40,
    );
    for (const p of points) {
      expect(p.py).toBe(20);
      expect(Number.isNaN(p.py)).toBe(false);
    }
  });

  it("spaces x-coordinates evenly across the usable width", () => {
    const padding = 10;
    const width = 110;
    const points = plotSparkline(
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 1 },
      ],
      width,
      40,
      padding,
    );
    expect(points[0].px).toBe(padding);
    expect(points[2].px).toBe(width - padding);
    expect(points[1].px).toBeCloseTo((points[0].px + points[2].px) / 2);
  });
});

describe("sparklinePath", () => {
  it("builds an SVG path starting with M and continuing with L", () => {
    const plotted = plotSparkline(
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 0.5 },
      ],
      100,
      40,
    );
    const path = sparklinePath(plotted);
    expect(path.startsWith("M ")).toBe(true);
    expect(path.split(" L ")).toHaveLength(3); // "M x y" + 2 "L x y" segments
  });

  it("returns an empty string for no points", () => {
    expect(sparklinePath([])).toBe("");
  });
});
