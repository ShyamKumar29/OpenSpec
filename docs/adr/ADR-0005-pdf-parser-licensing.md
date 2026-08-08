# ADR-0005 — pdfplumber + pypdfium2; reject PyMuPDF on licensing
Status: Accepted
Date: 2026-08-07

## Context
We need text extraction **with bounding boxes** (for the evidence highlight) and **table structure**
(for family datasheets). The obvious technical choice, PyMuPDF (fitz), is the fastest and has the
best coordinate API. The project is explicitly intended to become a commercial product.

## Options considered
| Option | Licence | Pros | Cons |
|---|---|---|---|
| PyMuPDF (fitz) | **AGPL-3.0** or paid commercial | Fastest; excellent bbox and rendering API | **AGPL is viral over network use.** A commercial SaaS would require a paid licence or open-sourcing the service. A trap that is very hard to unwind later |
| **pdfplumber** (MIT, on pdfminer.six) | MIT | Good table extraction, character-level coordinates | Slower; heavier on large documents |
| **pypdfium2** (BSD/Apache) | Permissive | Fast rendering for page rasterisation | Weaker table semantics |
| Cloud document AI | Commercial | Strong on scans | Cost per page; network dependency in the demo path; less control over spans |

## Decision
`pdfplumber` for text, tables, and character-level coordinates. `pypdfium2` for page rasterisation
(ADR-0012). Tesseract as the OCR fallback. **PyMuPDF is rejected on licensing grounds despite being
technically superior**, and this is recorded so nobody re-adds it "because it's faster."

## Consequences
**Easier:** no licensing liability; the commercial path stays open; all dependencies permissive.
**Harder:** parsing is slower — mitigated entirely by content-hash caching, since each document is
parsed once regardless of how many SKUs reference it.
**Accepted:** a measurable performance cost in exchange for removing a legal one.

## Revisit when
A paid PyMuPDF licence is acquired, or parse latency becomes a bottleneck that caching does not
solve. The `DocumentParser` port makes the swap a single adapter.
