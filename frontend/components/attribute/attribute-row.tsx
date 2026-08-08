import {
  attributeStatusToSemantic,
  isUnknownValue,
  type AttributeValue,
} from "@/lib/contracts/attribute-value";
import { ValueDisplay } from "./value-display";
import { ConfidenceIndicator } from "./confidence-indicator";
import { TierBadge } from "./tier-badge";
import { StatusBadge } from "./status-badge";
import { UnknownValue } from "./unknown-value";
import { EvidencePopover } from "./evidence-popover";

/**
 * Composes value, confidence, provenance, tier, status, and evidence as separate
 * concepts — never flattened into one column (docs/14-frontend-implementation-plan.md
 * §6 F1: "AttributeRow composes ValueDisplay · ConfidenceIndicator · ProvenanceChip ·
 * TierBadge · StatusChip · [why?] as separate concepts"). `ConfidenceIndicator`
 * composes `ProvenanceChip` internally (components/attribute/confidence-indicator.tsx)
 * so all six land here without duplicating that wiring.
 */
export function AttributeRow({ value }: { value: AttributeValue }) {
  return (
    <div
      data-testid="attribute-row"
      data-attribute-code={value.attribute.code}
      className="border-border/60 flex flex-col gap-1.5 border-b py-2.5 last:border-0 sm:flex-row sm:items-start sm:gap-4"
    >
      <div className="flex min-w-0 items-center gap-2 sm:w-60 sm:shrink-0">
        <span className="text-foreground truncate text-sm">{value.attribute.name}</span>
        <TierBadge tier={value.attribute.riskTier} />
      </div>

      <div className="min-w-0 flex-1">
        {isUnknownValue(value) ? (
          <UnknownValue reason={value.unknownReason} />
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <ValueDisplay value={value.valueDisplay} />
            <StatusBadge status={attributeStatusToSemantic(value.status)} />
            <ConfidenceIndicator value={value.confidence} provenance={value.provenanceKind} />
            <EvidencePopover value={value} />
          </div>
        )}
      </div>
    </div>
  );
}
