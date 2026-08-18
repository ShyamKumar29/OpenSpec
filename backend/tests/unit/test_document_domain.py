"""Tests for `domain/model/document.py` (M2 — PRS + DOC domain models)."""

from __future__ import annotations

import pytest

from openspec.domain.errors import InvariantViolation
from openspec.domain.model.document import (
    BindingMethod,
    BindingStatus,
    DocType,
    Document,
    DocumentBinding,
    DocumentPage,
    DocumentRegion,
    DocumentVersion,
    ParseArtifact,
    ParseStatus,
    RegionType,
)


def _page(n: int = 1) -> DocumentPage:
    return DocumentPage(n=n, width_px=1700, height_px=2200, dpi=200)


class TestDocumentPage:
    def test_valid_page_constructs(self) -> None:
        p = _page()
        assert p.n == 1 and p.dpi == 200

    @pytest.mark.parametrize(
        "kwargs",
        [
            {"n": 0},
            {"width_px": 0},
            {"height_px": -1},
            {"dpi": 0},
        ],
    )
    def test_invalid_page_raises(self, kwargs: dict[str, int]) -> None:
        base = {"n": 1, "width_px": 100, "height_px": 100, "dpi": 200}
        base.update(kwargs)
        with pytest.raises(InvariantViolation):
            DocumentPage(**base)


class TestDocumentRegion:
    def test_valid_region_constructs(self) -> None:
        r = DocumentRegion(
            id="docver_1/table1/row1",
            region_type=RegionType.ROW,
            page=2,
            bbox=(10.0, 20.0, 100.0, 40.0),
            path="table:1/row:1",
            text="70-104-01 1/2 600 WOG",
            parent_region_id="docver_1/table1",
        )
        assert r.region_type is RegionType.ROW

    def test_degenerate_bbox_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            DocumentRegion(
                id="r1",
                region_type=RegionType.CELL,
                page=1,
                bbox=(0.0, 0.0, 0.0, 0.0),
                path="table:1/row:1/cell:1",
                text=None,
                parent_region_id=None,
            )

    def test_empty_id_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            DocumentRegion(
                id="",
                region_type=RegionType.PAGE,
                page=1,
                bbox=(0.0, 0.0, 10.0, 10.0),
                path="page:1",
                text=None,
                parent_region_id=None,
            )


class TestDocumentVersion:
    def test_parsed_version_requires_matching_page_count(self) -> None:
        with pytest.raises(InvariantViolation):
            DocumentVersion(
                id="v1",
                document_id="d1",
                content_hash="sha256_abc",
                blob_key="blobs/v1.pdf",
                page_count=2,
                fetched_at="2026-08-14T00:00:00Z",
                effective_date=None,
                parse_status=ParseStatus.PARSED,
                pages=(_page(1),),  # only one page, page_count says 2
            )

    def test_pending_version_may_have_no_pages_yet(self) -> None:
        v = DocumentVersion(
            id="v1",
            document_id="d1",
            content_hash="sha256_abc",
            blob_key="blobs/v1.pdf",
            page_count=4,
            fetched_at="2026-08-14T00:00:00Z",
            effective_date=None,
            parse_status=ParseStatus.PENDING,
            pages=(),
        )
        assert v.parse_status is ParseStatus.PENDING

    def test_blank_content_hash_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            DocumentVersion(
                id="v1",
                document_id="d1",
                content_hash="",
                blob_key="blobs/v1.pdf",
                page_count=0,
                fetched_at="2026-08-14T00:00:00Z",
                effective_date=None,
                parse_status=ParseStatus.PENDING,
                pages=(),
            )


class TestDocument:
    def test_blank_title_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            Document(
                id="d1",
                tenant_id="t1",
                publisher="Apollo",
                title="",
                source_url=None,
                doc_type=DocType.SPEC_SHEET,
                first_seen_at="2026-08-01T00:00:00Z",
            )


class TestParseArtifact:
    def test_quality_out_of_range_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            ParseArtifact(
                id="pa1",
                document_version_id="v1",
                parser_name="pdfplumber",
                parser_version="0.11",
                parse_quality=1.5,
                has_text_layer=True,
                used_ocr=False,
                regions=(),
            )

    def test_valid_artifact_constructs(self) -> None:
        pa = ParseArtifact(
            id="pa1",
            document_version_id="v1",
            parser_name="pdfplumber",
            parser_version="0.11",
            parse_quality=0.95,
            has_text_layer=True,
            used_ocr=False,
            regions=(),
        )
        assert pa.parse_quality == 0.95


class TestDocumentBinding:
    def test_exact_mpn_may_be_accepted(self) -> None:
        b = DocumentBinding(
            id="b1",
            record_id="rec1",
            document_version_id="v1",
            region_id="table:1/row:14",
            confidence=0.99,
            signals={"exact_mpn_hit": True},
            method=BindingMethod.EXACT_MPN,
            status=BindingStatus.ACCEPTED,
        )
        assert b.status is BindingStatus.ACCEPTED

    def test_human_attach_may_be_accepted(self) -> None:
        b = DocumentBinding(
            id="b2",
            record_id="rec1",
            document_version_id="v1",
            region_id=None,
            confidence=1.0,
            signals={},
            method=BindingMethod.HUMAN,
            status=BindingStatus.ACCEPTED,
        )
        assert b.status is BindingStatus.ACCEPTED

    def test_text_overlap_cannot_be_auto_accepted(self) -> None:
        """M2 brief: 'do not allow a low-confidence match to become an asserted
        binding automatically' — enforced structurally, like INV-9."""
        with pytest.raises(InvariantViolation):
            DocumentBinding(
                id="b3",
                record_id="rec1",
                document_version_id="v1",
                region_id=None,
                confidence=0.4,
                signals={"text_overlap_score": 0.4},
                method=BindingMethod.TEXT_OVERLAP,
                status=BindingStatus.ACCEPTED,
            )

    def test_llm_disambiguation_cannot_be_auto_accepted(self) -> None:
        with pytest.raises(InvariantViolation):
            DocumentBinding(
                id="b4",
                record_id="rec1",
                document_version_id="v1",
                region_id=None,
                confidence=0.7,
                signals={},
                method=BindingMethod.LLM_DISAMBIGUATION,
                status=BindingStatus.ACCEPTED,
            )

    def test_rejected_status_is_constructible_for_any_method(self) -> None:
        """`REJECTED` (e.g. a reviewer explicitly rejecting a proposed binding) is
        not gated the way `ACCEPTED` is — only auto-*accepting* a weak signal is
        forbidden, not recording that a candidate was considered and turned down."""
        b = DocumentBinding(
            id="b8",
            record_id="rec1",
            document_version_id="v1",
            region_id=None,
            confidence=0.3,
            signals={},
            method=BindingMethod.TEXT_OVERLAP,
            status=BindingStatus.REJECTED,
        )
        assert b.status is BindingStatus.REJECTED

    def test_needs_review_status_always_allowed(self) -> None:
        b = DocumentBinding(
            id="b5",
            record_id="rec1",
            document_version_id="v1",
            region_id=None,
            confidence=0.5,
            signals={},
            method=BindingMethod.CLASS_MATCH,
            status=BindingStatus.NEEDS_REVIEW,
        )
        assert b.status is BindingStatus.NEEDS_REVIEW

    def test_confidence_out_of_range_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            DocumentBinding(
                id="b6",
                record_id="rec1",
                document_version_id="v1",
                region_id=None,
                confidence=1.5,
                signals={},
                method=BindingMethod.CLASS_MATCH,
            )

    def test_blank_record_id_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            DocumentBinding(
                id="b7",
                record_id="",
                document_version_id="v1",
                region_id=None,
                confidence=0.5,
                signals={},
                method=BindingMethod.CLASS_MATCH,
            )
