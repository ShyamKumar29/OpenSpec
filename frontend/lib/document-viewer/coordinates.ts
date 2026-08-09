/**
 * The ONE place a wire-space bbox becomes a normalised `[0,1]` rectangle
 * (docs/14-frontend-implementation-plan.md §3 C3, point 2: "Conversion from the wire
 * format happens once, in the contract adapter, nowhere else"). `AttributeValue.evidence`
 * and `DocumentRegion` both carry `bbox` in the *pixel space of the rendered page image*
 * for that `(version_id, page, dpi)` (docs/api.md §Documents) — this module is the only
 * place that pixel space is divided by a page's `widthPx`/`heightPx` to become a
 * DPI-, zoom-, and device-pixel-ratio-independent fraction. `DocumentViewer` and every
 * component under `components/document-viewer/` consume normalised rectangles only; none
 * of them re-derive a fraction from a raw bbox themselves (risk F-1).
 */
import type { DocumentPage } from "@/lib/contracts/document";

export interface NormalizedRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * A `[0,0,0,0]` bbox is how the fixture universe marks evidence that has no real
 * position (e.g. a binding into the unparseable document) — never a legitimate span,
 * since `x1 > x0` and `y1 > y0` always hold for a rendered rectangle. Also rejects a
 * bbox for a page whose dimensions are non-positive, which shouldn't occur but must
 * never divide-by-zero into a fabricated rectangle if it does.
 */
export function isValidBbox(bbox: [number, number, number, number]): boolean {
  const [x0, y0, x1, y1] = bbox;
  return Number.isFinite(x0) && Number.isFinite(y0) && Number.isFinite(x1) && Number.isFinite(y1)
    ? x1 > x0 && y1 > y0
    : false;
}

/**
 * Converts a pixel-space bbox to a normalised rectangle for the given page. Callers
 * MUST check `isValidBbox` (and that `page` exists) first — this function does not
 * itself decide whether the input represents real evidence; it only does the division.
 */
export function bboxToNormalizedRect(
  bbox: [number, number, number, number],
  page: Pick<DocumentPage, "widthPx" | "heightPx">,
): NormalizedRect {
  const [x0, y0, x1, y1] = bbox;
  if (page.widthPx <= 0 || page.heightPx <= 0) {
    throw new Error(
      `Contract violation: page has non-positive dimensions (${page.widthPx}x${page.heightPx})`,
    );
  }
  return {
    x0: clamp01(x0 / page.widthPx),
    y0: clamp01(y0 / page.heightPx),
    x1: clamp01(x1 / page.widthPx),
    y1: clamp01(y1 / page.heightPx),
  };
}

/** CSS `top`/`left`/`width`/`height` percentages for an absolutely-positioned overlay
 *  filling its parent (the rendered page image), derived from a normalised rectangle. */
export function rectToCssPercent(rect: NormalizedRect): {
  left: string;
  top: string;
  width: string;
  height: string;
} {
  return {
    left: `${rect.x0 * 100}%`,
    top: `${rect.y0 * 100}%`,
    width: `${(rect.x1 - rect.x0) * 100}%`,
    height: `${(rect.y1 - rect.y0) * 100}%`,
  };
}

/** Finds the page metadata for a given page number, or `null` if the document doesn't
 *  have that page (an out-of-range page reference is an invalid-evidence state, not a
 *  crash — `DocumentViewer` renders it as such). */
export function findPage(pages: DocumentPage[], pageNumber: number): DocumentPage | null {
  return pages.find((p) => p.n === pageNumber) ?? null;
}
