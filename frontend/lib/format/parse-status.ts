/**
 * Human-facing copy + semantic-status mapping for `DocumentDetail.parseStatus`
 * (docs/api.md §Documents: `pending` · `parsed` · `unparseable` · `ocr_fallback`). Reuses
 * the six-value semantic status system (`lib/status.ts`) for consistent numeral/glyph/
 * colour encoding rather than inventing a parallel one for documents.
 */
import type { ParseStatus } from "@/lib/contracts/document";
import type { SemanticStatus } from "@/lib/status";

export const PARSE_STATUS_COPY: Record<ParseStatus, { label: string; semantic: SemanticStatus }> = {
  parsed: { label: "Parsed", semantic: "accepted" },
  pending: { label: "Parsing pending", semantic: "needs-review" },
  ocr_fallback: { label: "OCR fallback", semantic: "needs-review" },
  unparseable: { label: "Unparseable", semantic: "rejected" },
};
