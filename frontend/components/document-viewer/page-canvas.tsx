"use client";

import { forwardRef } from "react";
import type { DocumentPage, DocumentRegion } from "@/lib/contracts/document";
import { RegionOverlay } from "./region-overlay";
import { SpanHighlight, type DocumentHighlight } from "./span-highlight";

/**
 * The rendered page image plus its overlays, sized by the page's own pixel aspect ratio
 * so `RegionOverlay`/`SpanHighlight` percentages always land on the right pixels
 * regardless of zoom (docs/06-frontend.md §4: `DocumentViewer` -> `PageCanvas`).
 * Server-rasterised, never client-side PDF parsing (ADR-0012, docs/06-frontend.md §7).
 */
export const PageCanvas = forwardRef<
  HTMLDivElement,
  {
    imageSrc: string;
    imageAlt: string;
    page: DocumentPage;
    zoom: number;
    regions: DocumentRegion[];
    highlights: DocumentHighlight[];
    activeHighlightId?: string | null;
    onSelectHighlight?: (id: string) => void;
  }
>(function PageCanvas(
  { imageSrc, imageAlt, page, zoom, regions, highlights, activeHighlightId, onSelectHighlight },
  highlightRef,
) {
  return (
    <div
      className="bg-background relative mx-auto shadow-sm"
      style={{
        width: `${zoom * 100}%`,
        aspectRatio: `${page.widthPx} / ${page.heightPx}`,
        minWidth: "280px",
      }}
      data-testid="page-canvas"
      data-page={page.n}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-rendered mock asset served
          from a redirect target, not a Next-optimisable local import */}
      <img
        src={imageSrc}
        alt={imageAlt}
        className="absolute inset-0 h-full w-full object-contain select-none"
        draggable={false}
      />
      <RegionOverlay regions={regions} page={page} />
      <SpanHighlight
        ref={highlightRef}
        highlights={highlights}
        page={page}
        activeId={activeHighlightId}
        onSelect={onSelectHighlight}
      />
    </div>
  );
});
