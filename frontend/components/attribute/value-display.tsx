import { cn } from "@/lib/utils";
import { SnippetText } from "./snippet-text";

/**
 * Renders `valueDisplay` — the pipeline's canonical display string for an asserted
 * `AttributeValue`. It is document-derived (normalised from an extracted span), so per
 * `SnippetText`'s contract ("document- or model-derived text renders through this
 * component only", INV-7) it composes `SnippetText` rather than interpolating the
 * string directly. Tabular numerals so values in a column (sizes, pressures, counts)
 * align (docs/06-frontend.md §5).
 */
export function ValueDisplay({ value, className }: { value: string; className?: string }) {
  return (
    <SnippetText
      text={value}
      className={cn("metric text-foreground text-sm font-medium", className)}
    />
  );
}
