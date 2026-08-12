/**
 * Pure geometry for the quality-trend mini line charts (`components/dashboard/quality-
 * trend-chart.tsx`, FR-DSH-4). No DOM, no React — mirrors the domain-purity discipline
 * CLAUDE.md asks of `domain/nrm`/`domain/val`, applied to the one piece of chart math
 * worth unit-testing directly rather than only eyeballing in the browser
 * (docs/14-frontend-implementation-plan.md §7: "Unit tests for logic that is not
 * trivially visual").
 *
 * Deliberately single-axis, single-hue (dataviz skill, "choosing a form": trend over
 * time -> line; sequential or one categorical). Two metrics of different scale (STP vs.
 * precision) are always two separate `Sparkline`s, never one chart with two y-scales —
 * "never a dual-axis chart" is the skill's #1 anti-pattern.
 */

export interface SparklinePoint {
  x: number;
  y: number;
}

export interface PlottedPoint extends SparklinePoint {
  /** Pixel coordinates within the chart's own viewBox. */
  px: number;
  py: number;
}

const DEFAULT_PADDING = 8;

/** Scales `points` into a viewBox of `width` x `height`, with `padding` on every edge so
 *  end markers never clip. Flat series (`minY === maxY`, e.g. exactly one data point, or
 *  a metric that hasn't moved) render as a level line through the vertical centre rather
 *  than dividing by zero. */
export function plotSparkline(
  points: SparklinePoint[],
  width: number,
  height: number,
  padding: number = DEFAULT_PADDING,
): PlottedPoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    return [{ ...points[0], px: width / 2, py: height / 2 }];
  }

  const ys = points.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const xStep = usableWidth / (points.length - 1);

  return points.map((p, i) => {
    const py =
      maxY === minY ? height / 2 : height - padding - ((p.y - minY) / (maxY - minY)) * usableHeight;
    return { ...p, px: padding + i * xStep, py };
  });
}

/** SVG `<path d>` for the plotted points — a plain polyline (`M`/`L`), matching the
 *  skill's mark spec ("Line: 2px, round join/cap") applied via the caller's stroke props. */
export function sparklinePath(plotted: PlottedPoint[]): string {
  return plotted.map((p, i) => `${i === 0 ? "M" : "L"} ${p.px} ${p.py}`).join(" ");
}
