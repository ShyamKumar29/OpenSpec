"use client";

import { forwardRef, useState } from "react";
import { ImageOff } from "lucide-react";
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
  // A page raster can legitimately be missing while the page itself exists (the corpus
  // fixtures only render the pages that carry parsed content). Left alone, the browser's
  // own broken-image glyph and the raw alt text leak into the workspace and read like a
  // bug in the viewer. This states the absence instead — and deliberately keeps the region
  // and highlight overlays mounted on top of it, because the geometry is still true and an
  // evidence rectangle is still worth showing even when the picture behind it is not there.
  const [imageFailed, setImageFailed] = useState(false);

  // Reset on a genuine source change, during render rather than in an effect — otherwise
  // paging away from a missing raster onto a present one keeps showing the failure.
  const [lastSrc, setLastSrc] = useState(imageSrc);
  if (imageSrc !== lastSrc) {
    setLastSrc(imageSrc);
    setImageFailed(false);
  }

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
      {imageFailed ? (
        <div
          className="border-border text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-2 border border-dashed px-6 text-center"
          data-testid="page-image-unavailable"
        >
          <ImageOff className="size-6" aria-hidden="true" />
          <p className="text-foreground text-sm font-medium">Page image unavailable</p>
          <p className="max-w-xs text-xs">
            No raster has been produced for page {page.n} of this document. Any evidence regions
            recorded against it are still outlined below.
          </p>
        </div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element -- pre-rendered mock asset served
           from a redirect target, not a Next-optimisable local import */
        <img
          src={imageSrc}
          alt={imageAlt}
          className="absolute inset-0 h-full w-full object-contain select-none"
          draggable={false}
          onError={() => setImageFailed(true)}
        />
      )}
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
