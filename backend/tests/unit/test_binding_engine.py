"""Tests for `domain/doc/binding_engine.py` (M2 — DOC retrieval hierarchy)."""

from __future__ import annotations

from openspec.domain.doc.binding_engine import (
    BindingCandidate,
    BindingNeedsDisambiguation,
    BindingPolicy,
    BindingResolved,
    BindingUnresolved,
    BindingUnresolvedReason,
    RowBindingResolved,
    RowBindingUnresolved,
    RowCandidate,
    detect_binding_conflict,
    resolve_document_binding,
    resolve_row_binding,
)
from openspec.domain.model.document import BindingMethod, BindingStatus, DocumentBinding

_POLICY = BindingPolicy(
    exact_mpn_confidence=0.99,
    normalized_mpn_confidence=0.95,
    supplier_match_confidence=0.85,
    class_match_confidence=0.7,
    text_overlap_confidence=0.6,
    text_overlap_threshold=0.6,
    llm_disambiguation_confidence=0.65,
    max_llm_disambiguation_pool=5,
)


def _candidate(
    doc_version_id: str,
    *,
    exact: bool = False,
    normalized: bool = False,
    supplier: bool = False,
    cls: bool = False,
    overlap: float = 0.0,
) -> BindingCandidate:
    return BindingCandidate(
        document_version_id=doc_version_id,
        exact_mpn_hit=exact,
        normalized_mpn_hit=normalized,
        supplier_match=supplier,
        class_match=cls,
        text_overlap_score=overlap,
    )


class TestResolveDocumentBinding:
    def test_no_candidates_is_unresolved(self) -> None:
        result = resolve_document_binding((), _POLICY)
        assert isinstance(result, BindingUnresolved)
        assert result.reason is BindingUnresolvedReason.NO_CANDIDATES

    def test_unique_exact_mpn_hit_resolves_immediately(self) -> None:
        candidates = (
            _candidate("v1", exact=True),
            _candidate("v2", supplier=True),
        )
        result = resolve_document_binding(candidates, _POLICY)
        assert isinstance(result, BindingResolved)
        assert result.scored.method is BindingMethod.EXACT_MPN
        assert result.scored.candidate.document_version_id == "v1"
        assert result.scored.confidence == _POLICY.exact_mpn_confidence

    def test_tie_at_exact_mpn_falls_through_to_normalized_tier(self) -> None:
        """Two candidates both exact-hit (unusual but possible); normalised-MPN
        narrows within that tied pool rather than restarting from scratch."""
        candidates = (
            _candidate("v1", exact=True, normalized=True),
            _candidate("v2", exact=True, normalized=False),
        )
        result = resolve_document_binding(candidates, _POLICY)
        assert isinstance(result, BindingResolved)
        assert result.scored.method is BindingMethod.NORMALIZED_MPN
        assert result.scored.candidate.document_version_id == "v1"

    def test_supplier_match_used_only_when_earlier_tiers_are_silent(self) -> None:
        candidates = (
            _candidate("v1", supplier=True),
            _candidate("v2", supplier=False),
        )
        result = resolve_document_binding(candidates, _POLICY)
        assert isinstance(result, BindingResolved)
        assert result.scored.method is BindingMethod.SUPPLIER_MATCH
        assert result.scored.candidate.document_version_id == "v1"

    def test_text_overlap_threshold_applied(self) -> None:
        candidates = (
            _candidate("v1", overlap=0.7),
            _candidate("v2", overlap=0.2),
        )
        result = resolve_document_binding(candidates, _POLICY)
        assert isinstance(result, BindingResolved)
        assert result.scored.method is BindingMethod.TEXT_OVERLAP
        assert result.scored.candidate.document_version_id == "v1"

    def test_fully_ambiguous_small_pool_needs_disambiguation(self) -> None:
        candidates = (_candidate("v1"), _candidate("v2"))
        result = resolve_document_binding(candidates, _POLICY)
        assert isinstance(result, BindingNeedsDisambiguation)
        assert {c.document_version_id for c in result.candidates} == {"v1", "v2"}

    def test_pool_larger_than_llm_threshold_is_honestly_ambiguous(self) -> None:
        pool_size = _POLICY.max_llm_disambiguation_pool + 1
        candidates = tuple(_candidate(f"v{i}") for i in range(pool_size))
        result = resolve_document_binding(candidates, _POLICY)
        assert isinstance(result, BindingUnresolved)
        assert result.reason is BindingUnresolvedReason.AMBIGUOUS_CANDIDATES
        assert len(result.candidates) == len(candidates)

    def test_never_picks_arbitrarily_among_a_tier_tie(self) -> None:
        candidates = (
            _candidate("v1", supplier=True),
            _candidate("v2", supplier=True),
        )
        result = resolve_document_binding(candidates, _POLICY)
        assert isinstance(result, BindingNeedsDisambiguation)
        assert len(result.candidates) == 2


class TestResolveRowBinding:
    def test_unique_catalog_no_hit_resolves(self) -> None:
        rows = (
            RowCandidate(region_id="r1", catalog_no_exact_hit=True, mpn_variant_hit=False),
            RowCandidate(region_id="r2", catalog_no_exact_hit=False, mpn_variant_hit=True),
        )
        result = resolve_row_binding(rows)
        assert isinstance(result, RowBindingResolved)
        assert result.region_id == "r1"

    def test_no_rows_is_unresolved(self) -> None:
        result = resolve_row_binding(())
        assert isinstance(result, RowBindingUnresolved)
        assert result.candidate_count == 0

    def test_ambiguous_rows_stay_unresolved_not_guessed(self) -> None:
        rows = (
            RowCandidate(region_id="r1", catalog_no_exact_hit=True, mpn_variant_hit=False),
            RowCandidate(region_id="r2", catalog_no_exact_hit=True, mpn_variant_hit=False),
        )
        result = resolve_row_binding(rows)
        assert isinstance(result, RowBindingUnresolved)
        assert result.candidate_count == 2


class TestDetectBindingConflict:
    def test_two_versions_of_same_document_is_a_conflict(self) -> None:
        bindings = (
            DocumentBinding(
                id="b1",
                record_id="rec1",
                document_version_id="v2023",
                region_id="r1",
                confidence=0.9,
                signals={},
                method=BindingMethod.SUPPLIER_MATCH,
            ),
            DocumentBinding(
                id="b2",
                record_id="rec1",
                document_version_id="v2025",
                region_id="r1",
                confidence=0.9,
                signals={},
                method=BindingMethod.SUPPLIER_MATCH,
            ),
        )
        assert detect_binding_conflict(bindings, {"v2023": "doc_x", "v2025": "doc_x"}) is True

    def test_single_binding_is_not_a_conflict(self) -> None:
        bindings = (
            DocumentBinding(
                id="b1",
                record_id="rec1",
                document_version_id="v1",
                region_id="r1",
                confidence=0.9,
                signals={},
                method=BindingMethod.EXACT_MPN,
                status=BindingStatus.ACCEPTED,
            ),
        )
        assert detect_binding_conflict(bindings, {"v1": "doc_x"}) is False

    def test_bindings_to_different_documents_are_not_a_conflict(self) -> None:
        bindings = (
            DocumentBinding(
                id="b1",
                record_id="rec1",
                document_version_id="v1",
                region_id="r1",
                confidence=0.9,
                signals={},
                method=BindingMethod.SUPPLIER_MATCH,
            ),
            DocumentBinding(
                id="b2",
                record_id="rec1",
                document_version_id="v2",
                region_id="r1",
                confidence=0.9,
                signals={},
                method=BindingMethod.SUPPLIER_MATCH,
            ),
        )
        assert detect_binding_conflict(bindings, {"v1": "doc_a", "v2": "doc_b"}) is False
