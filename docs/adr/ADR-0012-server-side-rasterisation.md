# ADR-0012 — Server-side PDF page rasterisation
Status: Accepted
Date: 2026-08-07

## Context
The evidence highlight is the product's most important UI element (`06-frontend.md` Thesis 1). It
requires rendering a PDF page and overlaying a rectangle at coordinates produced by the **parser**.
If the renderer's coordinate system differs from the parser's — different DPI, different origin,
different rotation handling — highlights land in the wrong place, which is worse than showing none.

## Options considered
| Option | Pros | Cons |
|---|---|---|
| Client-side PDF.js | No server rendering cost; text selectable | **Two independent coordinate systems** (PDF.js viewport vs pdfplumber chars) that must be reconciled per document; large client bundle; slower first paint; rotation and cropbox edge cases |
| Server-side rasterisation to cached PNGs | **One coordinate system, derived from the same page geometry as the parser**; fast client; cacheable by `(content_hash, page)` | Server CPU + storage; text not natively selectable |
| Hybrid | Best of both | Two code paths to maintain in a 4-week build |

## Decision
Render pages server-side with `pypdfium2` at a fixed DPI, cache the images by
`(document_content_hash, page, dpi)`, and serve them via `GET /documents/{v}/pages/{n}/image`.
Bounding boxes are transformed into the **same fixed-DPI pixel space** at parse time, so the overlay
is a plain positioned rectangle over an image.

## Consequences
**Easier:** highlight alignment is correct by construction; a whole class of "the box is 12px off"
bugs never exists; the client stays light; a visual regression test with fixed-position fixtures is
trivial to write.
**Harder:** server CPU and image storage; document text is not natively selectable in the viewer.
**Accepted:** storage is cheap and cached; text selection is served instead by displaying the stored
`snippet_text` alongside the image — which is what a reviewer actually needs.

## Revisit when
Users need in-document text search or selection, or image storage becomes a material cost at large
corpus sizes.
