"""Tests for `application/usecases/bind_document.py` — fake `LLMProvider`, real
`domain/doc/binding_engine.py` cascade underneath."""

from __future__ import annotations

from openspec.application.ports.llm import LlmResponse
from openspec.application.usecases.bind_document import bind_record_to_document
from openspec.domain.doc.binding_engine import (
    BindingCandidate,
    BindingPolicy,
    BindingUnresolvedReason,
)
from openspec.domain.errors import DomainAbstention
from openspec.domain.model.document import BindingMethod, BindingStatus

_POLICY = BindingPolicy(
    exact_mpn_confidence=0.99,
    normalized_mpn_confidence=0.95,
    supplier_match_confidence=0.85,
    class_match_confidence=0.7,
    text_overlap_confidence=0.6,
    text_overlap_threshold=0.6,
    llm_disambiguation_confidence=0.65,
    max_llm_disambiguation_pool=5,
    llm_model="offline",
)


class _FakeLlm:
    def __init__(self, content: str | None) -> None:
        self._content = content

    def complete(self, request: object) -> LlmResponse:
        if self._content is None:
            raise DomainAbstention("SYSTEM_ERROR", "offline mode")
        return LlmResponse(content=self._content, model="fake", tokens_in=1, tokens_out=1)


def _candidate(
    doc_version_id: str,
    *,
    exact_mpn_hit: bool = False,
    normalized_mpn_hit: bool = False,
    supplier_match: bool = False,
    class_match: bool = False,
    text_overlap_score: float = 0.0,
) -> BindingCandidate:
    return BindingCandidate(
        document_version_id=doc_version_id,
        exact_mpn_hit=exact_mpn_hit,
        normalized_mpn_hit=normalized_mpn_hit,
        supplier_match=supplier_match,
        class_match=class_match,
        text_overlap_score=text_overlap_score,
    )


def test_exact_mpn_hit_is_accepted() -> None:
    outcome = bind_record_to_document(
        record_id="rec1",
        mpn="ABC-123",
        description="1/2 BRS BALL VLV 600WOG",
        candidates=(_candidate("v1", exact_mpn_hit=True),),
        policy=_POLICY,
        created_at="2026-08-14T00:00:00Z",
    )
    assert outcome.binding is not None
    assert outcome.binding.status is BindingStatus.ACCEPTED
    assert outcome.binding.method is BindingMethod.EXACT_MPN


def test_supplier_match_is_needs_review_not_auto_accepted() -> None:
    outcome = bind_record_to_document(
        record_id="rec1",
        mpn="ABC-123",
        description="desc",
        candidates=(_candidate("v1", supplier_match=True),),
        policy=_POLICY,
        created_at="2026-08-14T00:00:00Z",
    )
    assert outcome.binding is not None
    assert outcome.binding.status is BindingStatus.NEEDS_REVIEW


def test_no_candidates_is_unresolved_with_no_binding() -> None:
    outcome = bind_record_to_document(
        record_id="rec1",
        mpn="ABC-123",
        description="desc",
        candidates=(),
        policy=_POLICY,
        created_at="2026-08-14T00:00:00Z",
    )
    assert outcome.binding is None
    assert outcome.unresolved_reason is BindingUnresolvedReason.NO_CANDIDATES


def test_ambiguous_pool_without_llm_stays_unresolved() -> None:
    outcome = bind_record_to_document(
        record_id="rec1",
        mpn="ABC-123",
        description="desc",
        candidates=(_candidate("v1"), _candidate("v2")),
        policy=_POLICY,
        created_at="2026-08-14T00:00:00Z",
    )
    assert outcome.binding is None
    assert outcome.unresolved_reason is BindingUnresolvedReason.AMBIGUOUS_CANDIDATES


def test_llm_disambiguation_picks_offered_candidate() -> None:
    outcome = bind_record_to_document(
        record_id="rec1",
        mpn="ABC-123",
        description="desc",
        candidates=(_candidate("v1"), _candidate("v2")),
        policy=_POLICY,
        created_at="2026-08-14T00:00:00Z",
        prompt_template="mpn={mpn} desc={description} options={options}",
        llm=_FakeLlm("v2"),
    )
    assert outcome.binding is not None
    assert outcome.binding.document_version_id == "v2"
    assert outcome.binding.method is BindingMethod.LLM_DISAMBIGUATION
    assert outcome.binding.status is BindingStatus.NEEDS_REVIEW  # never auto-accepted


def test_llm_cannot_invent_a_candidate() -> None:
    """The model proposing something outside the offered list must never become a
    binding — mirrors classify_record's taxonomy-validation discipline."""
    outcome = bind_record_to_document(
        record_id="rec1",
        mpn="ABC-123",
        description="desc",
        candidates=(_candidate("v1"), _candidate("v2")),
        policy=_POLICY,
        created_at="2026-08-14T00:00:00Z",
        prompt_template="mpn={mpn} desc={description} options={options}",
        llm=_FakeLlm("v999-not-offered"),
    )
    assert outcome.binding is None
    assert outcome.unresolved_reason is BindingUnresolvedReason.AMBIGUOUS_CANDIDATES


def test_llm_none_response_stays_unresolved() -> None:
    outcome = bind_record_to_document(
        record_id="rec1",
        mpn="ABC-123",
        description="desc",
        candidates=(_candidate("v1"), _candidate("v2")),
        policy=_POLICY,
        created_at="2026-08-14T00:00:00Z",
        prompt_template="mpn={mpn} desc={description} options={options}",
        llm=_FakeLlm("NONE"),
    )
    assert outcome.binding is None
    assert outcome.unresolved_reason is BindingUnresolvedReason.AMBIGUOUS_CANDIDATES


def test_llm_abstention_stays_unresolved() -> None:
    outcome = bind_record_to_document(
        record_id="rec1",
        mpn="ABC-123",
        description="desc",
        candidates=(_candidate("v1"), _candidate("v2")),
        policy=_POLICY,
        created_at="2026-08-14T00:00:00Z",
        prompt_template="mpn={mpn} desc={description} options={options}",
        llm=_FakeLlm(None),
    )
    assert outcome.binding is None
    assert outcome.unresolved_reason is BindingUnresolvedReason.AMBIGUOUS_CANDIDATES
