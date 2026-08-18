from __future__ import annotations

import pytest

from openspec.domain.errors import InvariantViolation
from openspec.domain.model.states import PipelineState, legal_next_states, transition


def test_happy_path_is_fully_connected() -> None:
    happy_path = [
        PipelineState.INGESTED,
        PipelineState.CLASSIFIED,
        PipelineState.SCHEMA_RESOLVED,
        PipelineState.DOC_BOUND,
        PipelineState.PARSED,
        PipelineState.EXTRACTED,
        PipelineState.VERIFIED,
        PipelineState.VALIDATED,
        PipelineState.NORMALISED,
        PipelineState.SCORED,
        PipelineState.PUBLISHED,
    ]
    current = happy_path[0]
    for target in happy_path[1:]:
        current = transition(current, target)
    assert current is PipelineState.PUBLISHED


def test_published_is_terminal() -> None:
    assert legal_next_states(PipelineState.PUBLISHED) == frozenset()


def test_illegal_transition_raises() -> None:
    with pytest.raises(InvariantViolation):
        transition(PipelineState.INGESTED, PipelineState.PUBLISHED)


def test_abstention_paths_all_reach_needs_review() -> None:
    for abstained in (
        PipelineState.CLASS_UNRESOLVED,
        PipelineState.NO_DOCUMENT,
        PipelineState.UNPARSEABLE,
    ):
        assert PipelineState.NEEDS_REVIEW in legal_next_states(abstained)
