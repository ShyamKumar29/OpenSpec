"""`OcrProvider` — the PRS OCR fallback boundary (M2 brief §3: "create the OCR
provider port; provide the existing offline/cached strategy if appropriate;
preserve confidence/provenance; route unavailable OCR safely"). Mirrors
`LLMProvider`'s `offline` adapter pattern: the composition root defaults to
`UnavailableOcrProvider` (`infrastructure/parsing/ocr.py`) rather than silently
fabricating recognised text when no OCR engine is actually installed in this
environment (verified: no `tesseract` binary on this machine — `docs/15-backend-
implementation-status.md`-style honesty, applied to a new dependency).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class OcrRecognized:
    text: str
    confidence: float | None  # engine-reported, if any — never fabricated


@dataclass(frozen=True, slots=True)
class OcrUnavailable:
    reason: str


OcrResult = OcrRecognized | OcrUnavailable


class OcrProvider(Protocol):
    def recognize(self, *, image: bytes) -> OcrResult:
        """`image` is a rasterised page (PNG bytes, from `PageRasterizer`). Returns
        `OcrUnavailable` rather than raising when no OCR engine is configured —
        `PRS` routes that into `ParseFailed(NO_TEXT_LAYER_OCR_UNAVAILABLE)`
        (`domain/prs/parse_result.py`), never a fabricated empty-text success."""
        ...
