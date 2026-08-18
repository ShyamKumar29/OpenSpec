"""Tests for `infrastructure/parsing/ocr.py`."""

from __future__ import annotations

from openspec.application.ports.ocr import OcrUnavailable
from openspec.infrastructure.parsing.ocr import TesseractOcrProvider, UnavailableOcrProvider


class TestUnavailableOcrProvider:
    def test_always_returns_unavailable(self) -> None:
        result = UnavailableOcrProvider().recognize(image=b"\x89PNG\r\n\x1a\n")
        assert isinstance(result, OcrUnavailable)

    def test_default_reason_is_non_empty(self) -> None:
        result = UnavailableOcrProvider().recognize(image=b"")
        assert isinstance(result, OcrUnavailable)
        assert result.reason

    def test_custom_reason_is_preserved(self) -> None:
        result = UnavailableOcrProvider(reason="feature-flagged off").recognize(image=b"")
        assert isinstance(result, OcrUnavailable)
        assert result.reason == "feature-flagged off"


class TestTesseractOcrProvider:
    def test_degrades_to_unavailable_when_binary_is_missing(self) -> None:
        """No `tesseract` binary is installed in this environment (verified this
        session) — the real adapter must degrade to `OcrUnavailable`, never raise
        and never fabricate recognised text."""
        result = TesseractOcrProvider().recognize(image=b"not a real image")
        assert isinstance(result, OcrUnavailable)
