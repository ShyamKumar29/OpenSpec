import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format/percent";
import { frontierDomain, plotFrontier } from "@/lib/evaluation/frontier-geometry";
import { EmptyState } from "@/components/state/empty-state";
import { LineChart } from "lucide-react";
import type { EvalRunDetail } from "@/lib/contracts/eval";

const WIDTH = 520;
const HEIGHT = 200;
const PADDING = 32;

/**
 * Precision vs. cost/SKU, with the "generic LLM, no abstention" baseline plotted
 * alongside OpenSpec's own points (docs/00-discovery.md, docs/12-hackathon-strategy.md:
 * "the frontier chart with the 'generic LLM, no abstention' point plotted... the visual
 * argument is [the proof]"). Only three points in this fixture set, so direct labels
 * beat a legend (dataviz skill: label directly when the series count is small) — a
 * legend would cost a second glance for information already on the chart.
 */
export function FrontierChart({
  frontier,
  className,
}: {
  frontier: EvalRunDetail["frontier"];
  className?: string;
}) {
  if (frontier.length === 0) {
    return (
      <EmptyState
        icon={LineChart}
        title="No frontier data for this run"
        description="Only the most recent eval run in this fixture set carries the full frontier breakdown — select the latest run to see it."
        className={className}
      />
    );
  }

  const domain = frontierDomain(frontier);
  const plotted = plotFrontier(frontier, WIDTH, HEIGHT, PADDING);
  const openSpecPoints = plotted
    .filter((p) => !p.isBaseline)
    .sort((a, b) => a.costUsdPerSku - b.costUsdPerSku);
  const baseline = plotted.find((p) => p.isBaseline);

  const yTicks = [domain.yMin, (domain.yMin + domain.yMax) / 2, domain.yMax];

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`Precision versus cost per SKU: ${frontier
          .map(
            (p) =>
              `${p.label} at $${p.costUsdPerSku.toFixed(3)}/SKU, ${formatPercent(p.precision)} precision${p.isBaseline ? " (baseline, no abstention)" : ""}`,
          )
          .join("; ")}`}
      >
        {/* Gridlines + y-axis labels */}
        {yTicks.map((t) => {
          const y =
            PADDING +
            (HEIGHT - PADDING * 2) * (1 - (t - domain.yMin) / (domain.yMax - domain.yMin || 1));
          return (
            <g key={t}>
              <line
                x1={PADDING}
                x2={WIDTH - PADDING}
                y1={y}
                y2={y}
                className="stroke-border"
                strokeWidth={1}
              />
              <text x={4} y={y + 3} className="fill-muted-foreground" fontSize={9}>
                {formatPercent(t)}
              </text>
            </g>
          );
        })}
        <text x={PADDING} y={HEIGHT - 6} className="fill-muted-foreground" fontSize={9}>
          $0
        </text>
        <text
          x={WIDTH - PADDING}
          y={HEIGHT - 6}
          textAnchor="end"
          className="fill-muted-foreground"
          fontSize={9}
        >
          ${domain.xMax.toFixed(3)}/SKU
        </text>

        {/* OpenSpec's own frontier — connected to show the cost/quality tradeoff between modes */}
        {openSpecPoints.length > 1 ? (
          <path
            d={openSpecPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.px} ${p.py}`).join(" ")}
            fill="none"
            className="stroke-chart-3"
            strokeWidth={2}
            strokeDasharray="4 3"
          />
        ) : null}

        {plotted.map((p) => (
          <g key={p.label}>
            <circle
              cx={p.px}
              cy={p.py}
              r={p.isBaseline ? 5 : 6}
              className={p.isBaseline ? "fill-card stroke-status-rejected" : "fill-chart-4"}
              strokeWidth={p.isBaseline ? 2 : 0}
            />
            <text
              x={p.px}
              y={p.py - 10}
              textAnchor={p.px > WIDTH - 90 ? "end" : "middle"}
              className="fill-foreground"
              fontSize={9}
              fontWeight={600}
            >
              {p.label}
            </text>
            <text
              x={p.px}
              y={p.py + 18}
              textAnchor={p.px > WIDTH - 90 ? "end" : "middle"}
              className="fill-muted-foreground"
              fontSize={8}
            >
              {formatPercent(p.precision)} · ${p.costUsdPerSku.toFixed(3)}/SKU
            </text>
          </g>
        ))}
      </svg>
      <p className="text-muted-foreground text-xs leading-snug">
        Each point is one operating mode&rsquo;s precision against its cost per SKU. The dashed line
        connects OpenSpec&rsquo;s own modes;{" "}
        <span className="text-status-rejected font-medium">
          {baseline?.label ?? "the baseline"}
        </span>{" "}
        is a generic LLM with no evidence gate and no abstention — same rough cost, meaningfully
        lower precision, because it always answers instead of returning{" "}
        <code className="text-[0.7rem]">Unknown</code>.
      </p>
    </div>
  );
}
