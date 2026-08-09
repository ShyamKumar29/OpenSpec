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
import { WhyPanelTrigger } from "@/components/why-panel/why-panel";

/**
 * Composes value, confidence, provenance, tier, status, and evidence as separate
 * concepts — never flattened into one column (docs/14-frontend-implementation-plan.md
 * §6 F1: "AttributeRow composes ValueDisplay · ConfidenceIndicator · ProvenanceChip ·
 * TierBadge · StatusChip · [why?] as separate concepts"). `ConfidenceIndicator`
 * composes `ProvenanceChip` internally (components/attribute/confidence-indicator.tsx)
 * so all six land here without duplicating that wiring.
 *
 * `[why?]` opens the full Why panel (`GET /attributes/{id}/explain`), reachable from
 * BOTH asserted and `Unknown` rows — the Unknown variant of the panel is as complete as
 * the value variant (FR-EXP-3; docs/06-frontend.md §3.2). F1's `EvidencePopover`, which
 * rendered only the record's already-fetched citation, is retired in F3.
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
          <div className="flex items-start gap-3">
            <UnknownValue reason={value.unknownReason} />
            <WhyPanelTrigger
              value={value}
              className="text-muted-foreground hover:text-foreground h-auto shrink-0 px-0 text-xs font-normal"
            />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <ValueDisplay value={value.valueDisplay} />
            <StatusBadge status={attributeStatusToSemantic(value.status)} />
            <ConfidenceIndicator value={value.confidence} provenance={value.provenanceKind} />
            <WhyPanelTrigger value={value} />
          </div>
        )}
      </div>
    </div>
  );
}
