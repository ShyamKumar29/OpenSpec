import { cn } from "@/lib/utils";
import { STATUS, type SemanticStatus } from "@/lib/status";

/**
 * The one place a semantic status is rendered as a coloured chip. Always numeral/glyph +
 * text — colour never carries meaning alone (NFR-ACC-3).
 */
export function StatusBadge({
  status,
  label,
  title,
  className,
}: {
  status: SemanticStatus;
  /** Override the default token label, e.g. to add a count. */
  label?: string;
  /** Override the default token description, e.g. a record-status-specific one
   *  (lib/format/record-status.ts) rather than the generic attribute-value one. */
  title?: string;
  className?: string;
}) {
  const token = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        token.fg,
        token.bg,
        className,
      )}
      title={title ?? token.description}
    >
      <span aria-hidden="true">{token.glyph}</span>
      <span>{label ?? token.label}</span>
    </span>
  );
}
