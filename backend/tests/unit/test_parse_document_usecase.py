"""Tests for `application/usecases/parse_document.py` — fake ports (standard
"unit test with fake ports" pattern, docs/05-backend.md §2), plus one pass against
the real `PdfplumberParser` + `InMemoryParseCache` to prove cache hit/miss end to end.
"""

from __future__ import annotations

from openspec.application.ports.ocr import OcrRecognized, OcrResult, OcrUnavailable
from openspec.application.ports.rasterizer import RasterizeError
from openspec.application.usecases.parse_document import parse_document
from openspec.domain.model.document import DocumentRegion, ParseArtifact, RegionType
from openspec.domain.prs.parse_result import (
    ParseFailed,
    ParseFailureReason,
    ParseOutcome,
    ParseSucceeded,
)
from openspec.infrastructure.parsing.parse_cache import InMemoryParseCache
from openspec.infrastructure.parsing.pdfplumber_parser import PdfplumberParser
from tests.fixtures.pdf.minimal_pdf import make_minimal_pdf


class _FakeParser:
    parser_name = "fake"
    parser_version = "v1"

    def __init__(self, outcome: ParseOutcome) -> None:
        self._outcome = outcome
        self.calls = 0

    def parse(self, *, document_version_id: str, content: bytes) -> ParseOutcome:
        self.calls += 1
        return self._outcome


class _FakeRasterizer:
    dpi = 200

    def __init__(self, *, raises: bool = False) -> None:
        self._raises = raises

    def render_page(self, *, content: bytes, page: int) -> bytes:
        if self._raises:
            raise RasterizeError("cannot render")
        return b"fake-png-bytes"


class _FakeOcr:
    def __init__(self, result: OcrResult) -> None:
        self._result = result

    def recognize(self, *, image: bytes) -> OcrResult:
        return self._result


def _no_text_artifact() -> ParseArtifact:
    return ParseArtifact(
        id="a1",
        document_version_id="v1",
        parser_name="fake",
        parser_version="v1",
        parse_quality=None,
        has_text_layer=False,
        used_ocr=False,
        regions=(
            DocumentRegion(
                id="v1/page:1",
                region_type=RegionType.PAGE,
                page=1,
                bbox=(0.0, 0.0, 612.0, 792.0),
                path="page:1",
                text=None,
                parent_region_id=None,
            ),
        ),
    )


class TestCacheBehaviour:
    def test_cache_miss_then_hit_with_the_real_parser(self) -> None:
        pdf_bytes = make_minimal_pdf(("Cache Me",))
        cache = InMemoryParseCache()
        parser = PdfplumberParser()

        first = parse_document(
            document_version_id="v1",
            content_hash="sha256_cache_test",
            content=pdf_bytes,
            parser=parser,
            cache=cache,
        )
        assert first.from_cache is False
        assert isinstance(first.outcome, ParseSucceeded)

        second = parse_document(
            document_version_id="v1",
            content_hash="sha256_cache_test",
            content=pdf_bytes,
            parser=parser,
            cache=cache,
        )
        assert second.from_cache is True
        assert isinstance(second.outcome, ParseSucceeded)
        assert second.outcome.artifact == first.outcome.artifact

    def test_failed_parses_are_never_cached(self) -> None:
        cache = InMemoryParseCache()
        fake_parser = _FakeParser(ParseFailed(ParseFailureReason.CORRUPT_FILE, "bad bytes"))

        parse_document(
            document_version_id="v1",
            content_hash="sha256_x",
            content=b"whatever",
            parser=fake_parser,
            cache=cache,
        )
        parse_document(
            document_version_id="v1",
            content_hash="sha256_x",
            content=b"whatever",
            parser=fake_parser,
            cache=cache,
        )
        assert fake_parser.calls == 2  # never served from cache — always retried


class TestOcrFallback:
    def test_no_ocr_configured_is_an_explicit_failure(self) -> None:
        fake_parser = _FakeParser(ParseSucceeded(artifact=_no_text_artifact()))
        result = parse_document(
            document_version_id="v1",
            content_hash="sha256_y",
            content=b"whatever",
            parser=fake_parser,
            cache=InMemoryParseCache(),
        )
        assert isinstance(result.outcome, ParseFailed)
        assert result.outcome.reason is ParseFailureReason.NO_TEXT_LAYER_OCR_UNAVAILABLE

    def test_ocr_unavailable_routes_to_explicit_failure(self) -> None:
        fake_parser = _FakeParser(ParseSucceeded(artifact=_no_text_artifact()))
        result = parse_document(
            document_version_id="v1",
            content_hash="sha256_z",
            content=b"whatever",
            parser=fake_parser,
            cache=InMemoryParseCache(),
            ocr_provider=_FakeOcr(OcrUnavailable(reason="no engine")),
            rasterizer=_FakeRasterizer(),
        )
        assert isinstance(result.outcome, ParseFailed)
        assert result.outcome.reason is ParseFailureReason.NO_TEXT_LAYER_OCR_UNAVAILABLE

    def test_successful_ocr_recovers_text_and_marks_used_ocr(self) -> None:
        fake_parser = _FakeParser(ParseSucceeded(artifact=_no_text_artifact()))
        result = parse_document(
            document_version_id="v1",
            content_hash="sha256_ocr_ok",
            content=b"whatever",
            parser=fake_parser,
            cache=InMemoryParseCache(),
            ocr_provider=_FakeOcr(OcrRecognized(text="Recovered Text", confidence=0.8)),
            rasterizer=_FakeRasterizer(),
        )
        assert isinstance(result.outcome, ParseSucceeded)
        assert result.outcome.artifact.used_ocr is True
        assert result.outcome.artifact.has_text_layer is True
        regions = result.outcome.artifact.regions
        block = next(r for r in regions if r.region_type is RegionType.BLOCK)
        assert block.text == "Recovered Text"

    def test_rasterize_failure_during_ocr_is_explicit(self) -> None:
        fake_parser = _FakeParser(ParseSucceeded(artifact=_no_text_artifact()))
        result = parse_document(
            document_version_id="v1",
            content_hash="sha256_raster_fail",
            content=b"whatever",
            parser=fake_parser,
            cache=InMemoryParseCache(),
            ocr_provider=_FakeOcr(OcrRecognized(text="won't be reached", confidence=None)),
            rasterizer=_FakeRasterizer(raises=True),
        )
        assert isinstance(result.outcome, ParseFailed)
