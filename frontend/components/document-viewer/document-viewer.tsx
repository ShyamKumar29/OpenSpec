"use client";

/**
 * The highest-risk, highest-value shared component (docs/06-frontend.md §4): the same
 * instance is used from Record Detail's document pane, the Why panel, and (eventually)
 * the Review Queue. Consumes document metadata, a page image URL, the region tree, and
 * evidence spans — all in normalised coordinates by the time they reach `PageCanvas`
 * (docs/14-frontend-implementation-plan.md §3 C3). No PDF is parsed client-side; the
 * image is a server-rasterised asset (ADR-0012).
 */
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, FileWarning } from "lucide-react";
import { apiUrl } from "@/lib/api/client";
import { useDocumentQuery, useDocumentRegionsQuery } from "@/lib/queries/documents";
import { findPage } from "@/lib/document-viewer/coordinates";
import { LoadingBlock } from "@/components/state/loading";
import { EmptyState } from "@/components/state/empty-state";
import { ErrorState } from "@/components/state/error-state";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PageCanvas } from "./page-canvas";
import { PageControls } from "./page-controls";
import type { DocumentHighlight } from "./span-highlight";
import { cn } from "@/lib/utils";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;
const ZOOM_DEFAULT = 1;

export interface DocumentViewerProps {
  documentVersionId: string;
  /** Evidence spans to render as highlight rectangles. Zero or more; when more than one
   *  shares a page, they're independently selectable (evidence selection). */
  highlights?: DocumentHighlight[];
  /** Which highlight is emphasised. Changing it jumps the viewer to that highlight's page. */
  activeHighlightId?: string | null;
  onActiveHighlightChange?: (id: string) => void;
  initialPage?: number;
  /** Accessible label and heading context, e.g. the attribute name this evidence proves. */
  title?: string;
  className?: string;
}

export function DocumentViewer({
  documentVersionId,
  highlights = [],
  activeHighlightId = null,
  onActiveHighlightChange,
  initialPage,
  title,
  className,
}: DocumentViewerProps) {
  const doc = useDocumentQuery(documentVersionId);
  const regions = useDocumentRegionsQuery(documentVersionId);

  const activeHighlight =
    highlights.find((h) => h.id === activeHighlightId) ?? highlights[0] ?? null;
  const [page, setPage] = useState(initialPage ?? activeHighlight?.page ?? 1);
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [expanded, setExpanded] = useState(false);
  const highlightLayerRef = useRef<HTMLDivElement>(null);
  const lastJumpedHighlightId = useRef<string | null>(null);

  // Jump to the active highlight's page whenever it changes (e.g. a new "show on page"
  // click, or a different citation selected) — never on the user's own page navigation.
  useEffect(() => {
    if (!activeHighlight) return;
    if (lastJumpedHighlightId.current === activeHighlight.id) return;
    lastJumpedHighlightId.current = activeHighlight.id;
    setPage(activeHighlight.page);
  }, [activeHighlight]);

  // Scroll the active highlight into view once the page it's on is rendered.
  useEffect(() => {
    if (!activeHighlight || activeHighlight.page !== page) return;
    const el = highlightLayerRef.current?.querySelector(
      `[data-highlight-id="${CSS.escape(activeHighlight.id)}"]`,
    );
    if (!el) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
      inline: "center",
    });
  }, [activeHighlight, page, doc.data]);

  const pageCount = doc.data?.pageCount ?? 0;
  const currentPageMeta = doc.data ? findPage(doc.data.pages, page) : null;

  function goPrevPage() {
    setPage((p) => Math.max(1, p - 1));
  }
  function goNextPage() {
    setPage((p) => Math.min(pageCount, p + 1));
  }
  function zoomIn() {
    setZoom((z) => Math.min(ZOOM_MAX, Number((z + ZOOM_STEP).toFixed(2))));
  }
  function zoomOut() {
    setZoom((z) => Math.max(ZOOM_MIN, Number((z - ZOOM_STEP).toFixed(2))));
  }
  function zoomReset() {
    setZoom(ZOOM_DEFAULT);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrevPage();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goNextPage();
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomIn();
    } else if (e.key === "-") {
      e.preventDefault();
      zoomOut();
    } else if (e.key === "0") {
      e.preventDefault();
      zoomReset();
    }
  }

  const imageSrc = documentVersionId
    ? apiUrl(`/documents/${documentVersionId}/pages/${page}/image`)
    : "";
  const label = title ? `Document viewer: ${title}` : "Document viewer";

  let body: React.ReactNode;

  if (doc.status === "pending" || regions.status === "pending") {
    body = (
      <div className="p-4" data-testid="document-viewer-loading">
        <LoadingBlock rows={1} className="mb-3 h-8" />
        <div className="bg-muted aspect-[1700/2200] w-full animate-pulse rounded" />
      </div>
    );
  } else if (doc.status === "error") {
    body = (
      <div className="p-4">
        <ErrorState error={doc.error} onRetry={() => doc.refetch()} />
      </div>
    );
  } else if (doc.data.parseStatus === "unparseable") {
    body = (
      <div className="p-4">
        <EmptyState
          icon={FileWarning}
          title="Document could not be parsed"
          description={`"${doc.data.title}" has no text layer and no page images are available. Attributes bound to it resolve to Unknown(DOCUMENT_UNPARSEABLE).`}
        />
      </div>
    );
  } else if (!currentPageMeta) {
    body = (
      <div className="p-4">
        <EmptyState
          icon={AlertTriangle}
          title="Evidence location unavailable"
          description="The cited page is outside this document's page range. This citation cannot be shown spatially — treat it as an invalid-evidence state, not a value to trust silently."
        />
      </div>
    );
  } else {
    body = (
      <>
        <PageControls
          page={page}
          pageCount={pageCount}
          onPrevPage={goPrevPage}
          onNextPage={goNextPage}
          zoom={zoom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onZoomReset={zoomReset}
          expanded={expanded}
          onToggleExpanded={() => setExpanded((v) => !v)}
        />
        <div
          className="max-h-[70vh] overflow-auto p-3"
          data-testid="document-viewer-canvas-scroll"
          // A scrollable region must itself be reachable by keyboard (axe
          // scrollable-region-focusable / WCAG 2.1.1) — Tab reaches it directly, and it
          // has its own accessible name distinct from the group label above it.
          tabIndex={0}
          role="region"
          aria-label={`Page ${page} of ${pageCount}`}
        >
          <PageCanvas
            ref={highlightLayerRef}
            imageSrc={imageSrc}
            imageAlt={`Page ${page} of ${doc.data.title}`}
            page={currentPageMeta}
            zoom={zoom}
            regions={regions.data ?? []}
            highlights={highlights}
            activeHighlightId={activeHighlight?.id ?? null}
            onSelectHighlight={onActiveHighlightChange}
          />
        </div>
      </>
    );
  }

  // The same labelled, testable wrapper in both places — the fullscreen dialog must
  // expose the identical `data-testid`/`role`/keyboard handling as the inline instance,
  // not a second, differently-shaped tree (a prior version of this component lost the
  // wrapper when expanded, silently dropping the testid and the keyboard scope).
  const viewer = (
    <div
      className={cn(
        "border-border bg-card flex min-h-0 flex-1 flex-col rounded-lg border",
        !expanded && className,
      )}
      role="group"
      aria-label={label}
      onKeyDown={onKeyDown}
      data-testid="document-viewer"
    >
      {body}
    </div>
  );

  if (!expanded) return viewer;

  return (
    <Dialog open={expanded} onOpenChange={setExpanded}>
      <DialogContent className="flex h-[90vh] max-h-[90vh] w-[95vw] max-w-[1400px] flex-col gap-2 p-3 sm:max-w-[1400px]">
        <DialogTitle className="sr-only">{label}</DialogTitle>
        {viewer}
      </DialogContent>
    </Dialog>
  );
}
