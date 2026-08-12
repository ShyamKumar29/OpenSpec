/**
 * Pure geometry for the precision/cost frontier chart (`components/evaluation/frontier-
 * chart.tsx`, FR-EVL, docs/03-ai-pipeline.md §8.3 "precision/STP frontier curve"). No
 * DOM, no React — same discipline as `lib/dashboard/sparkline.ts`, applied to a two-
 * value-per-point scatter instead of an index-series line, because a real x-axis (cost)
 * benefits from being unit-tested independently of anything rendering to a screen.
 */
export interface FrontierPoint {
  label: string;
  costUsdPerSku: number;
  precision: number;
  isBaseline: boolean;
}

export interface PlottedFrontierPoint extends FrontierPoint {
  px: number;
  py: number;
}

export interface FrontierDomain {
  xMax: number;
  yMin: number;
  yMax: number;
}

/** `yMin` floors to the nearest 5-point bucket below the lowest precision in the set (with
 *  a little headroom) rather than always starting at 0 — a 0.83-0.98 spread rendered
 *  against a 0-1 axis would flatten every point near the top, hiding the exact gap the
 *  chart exists to show. `xMax` gets 25% headroom so the rightmost point/label isn't
 *  clipped against the chart edge. */
export function frontierDomain(points: FrontierPoint[]): FrontierDomain {
  if (points.length === 0) return { xMax: 0.01, yMin: 0, yMax: 1 };
  const xMax = Math.max(...points.map((p) => p.costUsdPerSku), 0.001) * 1.25;
  const minPrecision = Math.min(...points.map((p) => p.precision));
  const yMin = Math.max(0, Math.floor(minPrecision * 20) / 20 - 0.05);
  return { xMax, yMin, yMax: 1 };
}

export function plotFrontier(
  points: FrontierPoint[],
  width: number,
  height: number,
  padding = 28,
): PlottedFrontierPoint[] {
  const { xMax, yMin, yMax } = frontierDomain(points);
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const yRange = yMax - yMin || 1;

  return points.map((p) => ({
    ...p,
    px: padding + (xMax === 0 ? 0 : (p.costUsdPerSku / xMax) * usableWidth),
    py: padding + usableHeight - ((p.precision - yMin) / yRange) * usableHeight,
  }));
}
