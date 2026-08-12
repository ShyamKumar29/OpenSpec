import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format/percent";
import { EmptyState } from "@/components/state/empty-state";
import { Activity } from "lucide-react";
import type { EvalRunDetail } from "@/lib/contracts/eval";

const WIDTH = 520;
const HEIGHT = 200;
const PADDING = 32;

/**
 * Predicted confidence (bucketed) vs. observed accuracy, diagonal overlaid — "a well-
 * calibrated curve hugging the diagonal is an instant, unarguable demonstration that the
 * confidence number means something" (docs/03-ai-pipeline.md §5.3). Bar height is
 * observed accuracy; the small marker on each bar is the bucket's mean *predicted*
 * confidence, so a reader can see both numbers without a second chart. Bucket `count` is
 * printed under each bar — a calibration curve without sample sizes invites exactly the
 * "n=3 in the top bucket" objection this product's own testing doctrine (ASM-7) warns
 * against for every other rate.
 */
export function ReliabilityDiagram({
  reliability,
  ece,
  className,
}: {
  reliability: EvalRunDetail["reliability"];
  /** ECE headline metric, if the caller has it — shown as a one-line readout beneath the
   *  chart so the diagram and its summary statistic are never presented separately. */
  ece?: number;
  className?: string;
}) {
  if (reliability.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No reliability data for this run"
        description="Only the most recent eval run in this fixture set carries the full calibration breakdown — select the latest run to see it."
        className={className}
      />
    );
  }

  const usableWidth = WIDTH - PADDING * 2;
  const usableHeight = HEIGHT - PADDING * 2;
  const barSlot = usableWidth / reliability.length;
  const barWidth = barSlot * 0.55;
  const maxCount = Math.max(1, ...reliability.map((b) => b.count));

  function yFor(v: number) {
    return PADDING + usableHeight * (1 - v);
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`Reliability diagram: ${reliability
          .map(
            (b) =>
              `predicted ${formatPercent(b.predictedMean)} confidence, observed ${formatPercent(b.observedAccuracy)} accuracy, n=${b.count}`,
          )
          .join(
            "; ",
          )}${ece !== undefined ? `. Expected calibration error ${ece.toFixed(3)}.` : ""}`}
      >
        {/* Diagonal reference — perfect calibration */}
        <line
          x1={PADDING}
          y1={yFor(0)}
          x2={WIDTH - PADDING}
          y2={yFor(1)}
          className="stroke-border"
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />
        <text
          x={WIDTH - PADDING}
          y={yFor(1) - 4}
          textAnchor="end"
          className="fill-muted-foreground"
          fontSize={8}
        >
          perfect calibration
        </text>

        {reliability.map((b, i) => {
          const cx = PADDING + barSlot * i + barSlot / 2;
          const barTop = yFor(b.observedAccuracy);
          const predictedY = yFor(b.predictedMean);
          return (
            <g key={`${b.bucketLow}-${b.bucketHigh}`}>
              <rect
                x={cx - barWidth / 2}
                y={barTop}
                width={barWidth}
                height={Math.max(0, yFor(0) - barTop)}
                className="fill-chart-3"
                rx={2}
              />
              {/* Predicted-confidence marker on the same bucket */}
              <line
                x1={cx - barWidth / 2 - 3}
                x2={cx + barWidth / 2 + 3}
                y1={predictedY}
                y2={predictedY}
                className="stroke-foreground"
                strokeWidth={2}
              />
              <text
                x={cx}
                y={HEIGHT - 18}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize={8}
              >
                {formatPercent(b.bucketLow)}–{formatPercent(b.bucketHigh)}
              </text>
              <text
                x={cx}
                y={HEIGHT - 6}
                textAnchor="middle"
                className="fill-muted-foreground metric"
                fontSize={8}
              >
                n={b.count}
              </text>
              <text
                x={cx}
                y={barTop - 5}
                textAnchor="middle"
                className="fill-foreground metric"
                fontSize={8}
                fontWeight={600}
              >
                {formatPercent(b.observedAccuracy)}
              </text>
              <title>
                {`${formatPercent(b.bucketLow)}–${formatPercent(b.bucketHigh)} predicted: predicted mean ${formatPercent(b.predictedMean)}, observed accuracy ${formatPercent(b.observedAccuracy)}, n=${b.count} (${Math.round((b.count / maxCount) * 100)}% of largest bucket)`}
              </title>
            </g>
          );
        })}
      </svg>
      <p className="text-muted-foreground text-xs leading-snug">
        Bar height is observed accuracy per confidence bucket; the horizontal tick is the
        bucket&rsquo;s mean predicted confidence. A bar close to the dashed diagonal means the
        confidence number is decision-grade — &ldquo;0.94&rdquo; really does mean roughly 94%
        correct.
        {ece !== undefined ? (
          <>
            {" "}
            Expected Calibration Error for this run:{" "}
            <span className="metric text-foreground font-semibold">{ece.toFixed(3)}</span> (QR-13,
            target ≤0.05).
          </>
        ) : null}
      </p>
    </div>
  );
}
