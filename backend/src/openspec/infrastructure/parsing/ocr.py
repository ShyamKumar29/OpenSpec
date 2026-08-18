"""OCR provider adapters (`application/ports/ocr.py`). Mirrors `LLMProvider`'s
`offline` pattern: the composition root defaults to `UnavailableOcrProvider`
because **no `tesseract` binary is installed in this environment** (verified this
session: `tesseract` is not on `PATH`) — this project follows ADR-0005's own
"Tesseract as the OCR fallback" decision, but a scanned-document fallback path this
sandbox cannot actually exercise must say so honestly rather than fabricate
recognised text.

`TesseractOcrProvider` is real, working code for any environment that *does* have
the `tesseract` binary installed (`pytesseract` is a thin subprocess wrapper around
it) — it is simply not the default adapter here.
"""

from __future__ import annotations

import io

from openspec.application.ports.ocr import OcrRecognized, OcrResult, OcrUnavailable


class UnavailableOcrProvider:
    """The safe default (M2 brief §3: "route unavailable OCR safely"). Every call
    returns `OcrUnavailable` — never raises, never fabricates text — so
    `application/usecases/parse_document.py` can route it into
    `ParseFailed(NO_TEXT_LAYER_OCR_UNAVAILABLE)` uniformly regardless of *why* OCR
    isn't available (no binary, no license, feature-flagged off)."""

    def __init__(self, reason: str = "OCR engine not configured in this environment") -> None:
        self._reason = reason

    def recognize(self, *, image: bytes) -> OcrResult:
        return OcrUnavailable(reason=self._reason)


class TesseractOcrProvider:
    """Real adapter: `pytesseract` shells out to the `tesseract` binary. Returns
    `OcrUnavailable` (not a raised exception) if the binary itself isn't reachable —
    an environment gap is not a contract violation, so it degrades to the same typed
    outcome `UnavailableOcrProvider` always returns, rather than crashing the
    pipeline stage that called it."""

    def recognize(self, *, image: bytes) -> OcrResult:
        try:
            import pytesseract
            from PIL import Image
        except ImportError as exc:  # pragma: no cover — dependency always installed
            # in this repo (pyproject.toml); guarded for a stripped-down environment.
            return OcrUnavailable(reason=f"pytesseract/Pillow not importable: {exc}")

        try:
            pil_image = Image.open(io.BytesIO(image))
            data = pytesseract.image_to_data(pil_image, output_type=pytesseract.Output.DICT)
        except Exception as exc:  # noqa: BLE001 — the tesseract binary missing/
            # unreachable/erroring is exactly the "route unavailable OCR safely"
            # case this whole module exists for, not a bug to propagate.
            return OcrUnavailable(reason=f"tesseract OCR failed: {exc}")

        words = [w for w in data.get("text", []) if w.strip()]
        confidences = [float(c) for c in data.get("conf", []) if str(c).strip() not in ("", "-1")]
        text = " ".join(words)
        if not text.strip():
            return OcrUnavailable(reason="tesseract produced no recognisable text")
        mean_confidence = (sum(confidences) / len(confidences) / 100.0) if confidences else None
        return OcrRecognized(text=text, confidence=mean_confidence)
