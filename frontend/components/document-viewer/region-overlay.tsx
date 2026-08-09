/**
 * Faint outlines for every row region on the current page — the table context around a
 * highlighted span (docs/06-frontend.md §4: `DocumentViewer` -> `RegionOverlay`;
 * demo beat 3, "the highlighted family-table row"). Deliberately quiet: `SpanHighlight`
 * carries the actual evidence emphasis, this only orients the reader inside the table.
 * Row regions are `aria-hidden` — the document's structure is not itself informative
 * to a screen reader; the evidence text equivalent is carried separately (NFR-ACC).
 */
import type { DocumentPage, DocumentRegion } from "@/lib/contracts/document";
import {
  bboxToNormalizedRect,
  isValidBbox,
  rectToCssPercent,
} from "@/lib/document-viewer/coordinates";

export function RegionOverlay({
  regions,
  page,
  regionType = "row",
}: {
  regions: DocumentRegion[];
  page: DocumentPage;
  regionType?: DocumentRegion["regionType"];
}) {
  const onPage = regions.filter((r) => r.page === page.n && r.regionType === regionType);

  return (
    <div
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
      data-testid="region-overlay"
    >
      {onPage.map((region) => {
        if (!isValidBbox(region.bbox)) return null;
        const rect = bboxToNormalizedRect(region.bbox, page);
        return (
          <div
            key={region.id}
            className="border-border/50 absolute border"
            style={rectToCssPercent(rect)}
          />
        );
      })}
    </div>
  );
}
