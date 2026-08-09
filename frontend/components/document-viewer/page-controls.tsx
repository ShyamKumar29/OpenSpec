"use client";

import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Page navigation, zoom, fit-to-view, and fullscreen/expand — the controls strip above
 * `PageCanvas` (docs/06-frontend.md §4: `DocumentViewer` -> `PageControls`). Every
 * control is a real, labelled, focusable button — no bare icon-only affordance without
 * an accessible name (NFR-ACC-1/2).
 */
export function PageControls({
  page,
  pageCount,
  onPrevPage,
  onNextPage,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  expanded,
  onToggleExpanded,
}: {
  page: number;
  pageCount: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  return (
    <div className="border-border bg-muted/30 flex flex-wrap items-center justify-between gap-2 rounded-t-lg border-b px-2 py-1.5">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onPrevPage}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </Button>
        <span className="metric text-muted-foreground min-w-[5.5rem] text-center text-xs">
          Page {page} of {pageCount}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onNextPage}
          disabled={page >= pageCount}
          aria-label="Next page"
        >
          <ChevronRight />
        </Button>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" onClick={onZoomOut} aria-label="Zoom out">
          <ZoomOut />
        </Button>
        <span className="metric text-muted-foreground w-10 text-center text-xs">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="ghost" size="icon-sm" onClick={onZoomIn} aria-label="Zoom in">
          <ZoomIn />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onZoomReset} aria-label="Fit to view">
          <RotateCcw />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleExpanded}
          aria-label={expanded ? "Exit fullscreen" : "Expand to fullscreen"}
          aria-pressed={expanded}
        >
          {expanded ? <Minimize2 /> : <Maximize2 />}
        </Button>
      </div>
    </div>
  );
}
