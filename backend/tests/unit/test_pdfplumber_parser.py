"""Tests for `infrastructure/parsing/pdfplumber_parser.py` — the real adapter run
against a hand-built, deterministic PDF fixture (`tests/fixtures/pdf/minimal_pdf.py`).
**Not a real-world corpus test** — see that fixture module's own docstring and
`docs/15-backend-implementation-status.md` for the honest real-corpus-blocked status.
This proves the adapter genuinely parses real PDF bytes, not that it is accurate on
real manufacturer documents (no such documents exist in this environment).
"""

from __future__ import annotations

from openspec.domain.model.document import RegionType
from openspec.domain.prs.parse_result import ParseFailed, ParseFailureReason, ParseSucceeded
from openspec.infrastructure.parsing.pdfplumber_parser import PdfplumberParser
from tests.fixtures.pdf.minimal_pdf import make_minimal_pdf, make_multi_page_pdf, make_table_pdf


def test_parses_real_pdf_bytes_and_extracts_text() -> None:
    pdf_bytes = make_minimal_pdf(("Hello World",))
    outcome = PdfplumberParser().parse(document_version_id="docver_test", content=pdf_bytes)
    assert isinstance(outcome, ParseSucceeded)
    assert outcome.artifact.has_text_layer is True
    assert outcome.artifact.used_ocr is False
    page_region = next(r for r in outcome.artifact.regions if r.path == "page:1")
    assert page_region.page == 1
    block_region = next(r for r in outcome.artifact.regions if r.path == "block:1")
    assert block_region.text is not None
    assert "Hello" in block_region.text and "World" in block_region.text


def test_multi_line_document_produces_all_text() -> None:
    pdf_bytes = make_minimal_pdf(("Apollo 70-104-01", "1/2 NPS 600 WOG"))
    outcome = PdfplumberParser().parse(document_version_id="docver_test", content=pdf_bytes)
    assert isinstance(outcome, ParseSucceeded)
    block_region = next(r for r in outcome.artifact.regions if r.path == "block:1")
    assert block_region.text is not None
    assert "Apollo" in block_region.text
    assert "600" in block_region.text


def test_empty_bytes_is_an_explicit_failure_not_an_empty_document() -> None:
    outcome = PdfplumberParser().parse(document_version_id="docver_test", content=b"")
    assert isinstance(outcome, ParseFailed)
    assert outcome.reason is ParseFailureReason.EMPTY_DOCUMENT


def test_corrupt_bytes_is_an_explicit_failure_not_a_crash() -> None:
    outcome = PdfplumberParser().parse(
        document_version_id="docver_test", content=b"this is not a pdf at all"
    )
    assert isinstance(outcome, ParseFailed)
    assert outcome.reason is ParseFailureReason.CORRUPT_FILE


def test_parse_is_deterministic_across_repeated_calls() -> None:
    pdf_bytes = make_minimal_pdf(("Deterministic Check",))
    parser = PdfplumberParser()
    outcome_1 = parser.parse(document_version_id="docver_test", content=pdf_bytes)
    outcome_2 = parser.parse(document_version_id="docver_test", content=pdf_bytes)
    assert isinstance(outcome_1, ParseSucceeded)
    assert isinstance(outcome_2, ParseSucceeded)
    assert outcome_1.artifact.regions == outcome_2.artifact.regions


def test_region_ids_are_scoped_by_document_version_id() -> None:
    pdf_bytes = make_minimal_pdf(("Scoped IDs",))
    outcome = PdfplumberParser().parse(document_version_id="docver_scoped", content=pdf_bytes)
    assert isinstance(outcome, ParseSucceeded)
    assert all(r.id.startswith("docver_scoped/") for r in outcome.artifact.regions)


def test_multi_page_document_produces_a_page_region_per_page() -> None:
    pdf_bytes = make_multi_page_pdf((("Page One",), ("Page Two", "Second Line")))
    outcome = PdfplumberParser().parse(document_version_id="docver_multi", content=pdf_bytes)
    assert isinstance(outcome, ParseSucceeded)
    page_regions = [r for r in outcome.artifact.regions if r.region_type is RegionType.PAGE]
    assert {r.page for r in page_regions} == {1, 2}
    block_regions = {
        r.page: r for r in outcome.artifact.regions if r.region_type is RegionType.BLOCK
    }
    assert block_regions[1].text is not None and "Page One" in block_regions[1].text
    assert block_regions[2].text is not None and "Page Two" in block_regions[2].text


def test_parser_identity_is_stable() -> None:
    parser = PdfplumberParser()
    assert parser.parser_name == "pdfplumber"
    assert parser.parser_version  # non-empty, whatever the installed version is


class TestTableExtraction:
    """Real table detection — a stroked grid pdfplumber's own `find_tables()`
    genuinely recognises (verified this session against the fixture below), not
    just the decoupled `domain/prs/table_regions.py` builder tested with a
    hand-constructed `RawTable` elsewhere."""

    def test_a_real_gridded_table_produces_table_row_cell_regions(self) -> None:
        pdf_bytes = make_table_pdf(
            (("Catalog No.", "Size", "Spec"), ("70-104-01", "1/2", "600 WOG"))
        )
        outcome = PdfplumberParser().parse(document_version_id="docver_table", content=pdf_bytes)
        assert isinstance(outcome, ParseSucceeded)
        regions = outcome.artifact.regions
        assert any(r.region_type is RegionType.TABLE for r in regions)
        assert any(r.region_type is RegionType.ROW for r in regions)
        cells = [r for r in regions if r.region_type is RegionType.CELL]
        assert len(cells) == 6  # 2 rows x 3 columns
        cell_texts = {c.text for c in cells}
        assert "70-104-01" in cell_texts
        assert "600 WOG" in cell_texts

    def test_table_regions_are_parented_correctly(self) -> None:
        pdf_bytes = make_table_pdf((("A", "B"), ("C", "D")))
        outcome = PdfplumberParser().parse(document_version_id="docver_table2", content=pdf_bytes)
        assert isinstance(outcome, ParseSucceeded)
        regions = outcome.artifact.regions
        table_region = next(r for r in regions if r.region_type is RegionType.TABLE)
        row_regions = [r for r in regions if r.region_type is RegionType.ROW]
        assert all(r.parent_region_id == table_region.id for r in row_regions)
        cell_regions = [r for r in regions if r.region_type is RegionType.CELL]
        row_ids = {r.id for r in row_regions}
        assert all(c.parent_region_id in row_ids for c in cell_regions)

    def test_document_with_no_visible_grid_has_no_table_regions(self) -> None:
        pdf_bytes = make_minimal_pdf(("Just plain text, no table",))
        outcome = PdfplumberParser().parse(document_version_id="docver_notable", content=pdf_bytes)
        assert isinstance(outcome, ParseSucceeded)
        assert not any(r.region_type is RegionType.TABLE for r in outcome.artifact.regions)
