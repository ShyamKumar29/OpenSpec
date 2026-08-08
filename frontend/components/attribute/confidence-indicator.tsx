import { cn } from "@/lib/utils";
import { confidenceGlyph, formatConfidence } from "@/lib/format/confidence";
import type { ProvenanceKind } from "@/lib/contracts/attribute-value";
import { ProvenanceChip } from "./provenance-chip";

/**
 * The single primitive that renders a confidence score. Numeral + glyph + text +
 * colour together (NFR-ACC-3) — never colour alone, never a bare number.
 * `tests/architecture/confidence-formatting.test.ts` asserts no other component
 * formats a raw confidence number.
 */
export function ConfidenceIndicator({
  value,
  provenance,
  className,
}: {
  value: number;
  provenance?: ProvenanceKind;
  className?: string;
}) {
  const glyph = confidenceGlyph(value);
  const tone =
    glyph === "●"
      ? "text-status-accepted"
      : glyph === "◐"
        ? "text-status-needs-review"
        : "text-status-rejected";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <span className={cn("metric font-medium", tone)}>
        <span aria-hidden="true">{glyph}</span> {formatConfidence(value)}
      </span>
      {provenance ? <ProvenanceChip kind={provenance} /> : null}
    </span>
  );
}
