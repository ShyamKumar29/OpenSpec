import { StatusBadge } from "./status-badge";
import { UNKNOWN_REASON_COPY } from "@/lib/format/unknown-reason";
import type { UnknownReason } from "@/lib/contracts/attribute-value";

/**
 * INV-4: `Unknown` is first-class, always with a machine-readable reason — never `null`,
 * never `"N/A"`. This is the ONLY component permitted to render an absent value; there
 * is no `?? '—'` fallback anywhere else in the codebase for a value field.
 */
export function UnknownValue({
  reason,
  compact = false,
}: {
  reason: UnknownReason;
  /** Compact form omits the remediation hint (e.g. inside a dense table cell). */
  compact?: boolean;
}) {
  const copy = UNKNOWN_REASON_COPY[reason];
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <StatusBadge status="unknown" label={copy.label} />
      </div>
      {!compact ? (
        <p className="text-muted-foreground text-xs">
          {copy.remediation}{" "}
          <span className="text-muted-foreground/70">— fix owner: {copy.fixOwner}</span>
        </p>
      ) : null}
    </div>
  );
}
