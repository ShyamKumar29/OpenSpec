"use client";

/**
 * The evidence rectangle(s) on top of the rendered page — "a highlighted rectangle on
 * the rendered page, right next to the value ... is proof" (docs/06-frontend.md §1).
 * Each highlight is a real, focusable, labelled button — clicking or activating one
 * selects it (`onSelect`), which is the "evidence selection" feature named in
 * docs/14-frontend-implementation-plan.md §6 F2 (relevant when an `AttributeValue`
 * carries more than one evidence citation). The `sr-only` label satisfies NFR-ACC's
 * "the document viewer exposes the evidence snippet as text, not just as an image".
 */
import { forwardRef } from "react";
import type { DocumentPage } from "@/lib/contracts/document";
import {
  bboxToNormalizedRect,
  isValidBbox,
  rectToCssPercent,
} from "@/lib/document-viewer/coordinates";
import { cn } from "@/lib/utils";

export interface DocumentHighlight {
  id: string;
  page: number;
  bbox: [number, number, number, number];
  /** Text equivalent for the highlighted span — the verbatim snippet, ideally. */
  label: string;
  kind?: "primary" | "candidate";
}

export const SpanHighlight = forwardRef<
  HTMLDivElement,
  {
    highlights: DocumentHighlight[];
    page: DocumentPage;
    activeId?: string | null;
    onSelect?: (id: string) => void;
  }
>(function SpanHighlight({ highlights, page, activeId, onSelect }, ref) {
  const onPage = highlights.filter((h) => h.page === page.n && isValidBbox(h.bbox));

  return (
    <div ref={ref} className="absolute inset-0" data-testid="span-highlight-layer">
      {onPage.map((highlight) => {
        const rect = bboxToNormalizedRect(highlight.bbox, page);
        const isActive = activeId ? highlight.id === activeId : highlight.kind !== "candidate";
        return (
          <button
            key={highlight.id}
            type="button"
            data-testid="evidence-highlight"
            data-highlight-id={highlight.id}
            data-active={isActive}
            title={highlight.label}
            onClick={() => onSelect?.(highlight.id)}
            className={cn(
              "focus-visible:ring-ring absolute rounded-[2px] transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
              isActive
                ? "bg-status-needs-approval/25 ring-status-needs-approval ring-2"
                : "ring-status-needs-review/60 hover:bg-status-needs-review/15 ring-dashed bg-transparent ring-1",
            )}
            style={rectToCssPercent(rect)}
          >
            <span className="sr-only">
              {isActive ? "Evidence: " : "Candidate evidence: "}
              {highlight.label}
            </span>
          </button>
        );
      })}
    </div>
  );
});
