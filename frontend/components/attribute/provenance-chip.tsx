import { cn } from "@/lib/utils";
import type { ProvenanceKind } from "@/lib/contracts/attribute-value";

/**
 * Display-only. Provenance is never derived or promoted client-side (INV-5) — this
 * component reads a stored `provenance_kind` and nothing else; it has no logic that
 * could rank or upgrade one kind into another.
 */
const PROVENANCE_LABEL: Record<ProvenanceKind, string> = {
  EXTRACTED: "Extracted",
  DERIVED: "Derived",
  INFERRED: "Inferred",
  HUMAN: "Human",
};

const PROVENANCE_CLASS: Record<ProvenanceKind, string> = {
  EXTRACTED: "border-border text-foreground",
  DERIVED: "border-border text-muted-foreground",
  INFERRED: "border-dashed border-border text-muted-foreground",
  HUMAN: "border-status-accepted/40 text-status-accepted",
};

export function ProvenanceChip({ kind, className }: { kind: ProvenanceKind; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full border px-1.5 text-[11px] font-medium tracking-wide uppercase",
        PROVENANCE_CLASS[kind],
        className,
      )}
    >
      {PROVENANCE_LABEL[kind]}
    </span>
  );
}
