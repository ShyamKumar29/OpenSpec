"""The pipeline state machine (docs/02-architecture.md §4). Pure: given a current
state and a target, says whether the transition is legal. The orchestrator
(`application/usecases/enrich_record.py`, not yet built) is responsible for actually
persisting each transition before running the next stage — that durability guarantee
lives outside this module, which only knows the graph.
"""

from __future__ import annotations

from enum import StrEnum

from openspec.domain.errors import InvariantViolation


class PipelineState(StrEnum):
    INGESTED = "INGESTED"
    CLASSIFIED = "CLASSIFIED"
    CLASS_UNRESOLVED = "CLASS_UNRESOLVED"
    SCHEMA_RESOLVED = "SCHEMA_RESOLVED"
    DOC_BOUND = "DOC_BOUND"
    NO_DOCUMENT = "NO_DOCUMENT"
    PARSED = "PARSED"
    UNPARSEABLE = "UNPARSEABLE"
    EXTRACTED = "EXTRACTED"
    VERIFIED = "VERIFIED"
    VALIDATED = "VALIDATED"
    NORMALISED = "NORMALISED"
    SCORED = "SCORED"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    PUBLISHED = "PUBLISHED"


# Adjacency list transcribed directly from the `stateDiagram-v2` in
# docs/02-architecture.md §4 — kept 1:1 with the docs so the two can be diffed by eye.
_TRANSITIONS: dict[PipelineState, frozenset[PipelineState]] = {
    PipelineState.INGESTED: frozenset({PipelineState.CLASSIFIED, PipelineState.CLASS_UNRESOLVED}),
    PipelineState.CLASSIFIED: frozenset({PipelineState.SCHEMA_RESOLVED}),
    PipelineState.SCHEMA_RESOLVED: frozenset({PipelineState.DOC_BOUND, PipelineState.NO_DOCUMENT}),
    PipelineState.DOC_BOUND: frozenset({PipelineState.PARSED, PipelineState.UNPARSEABLE}),
    PipelineState.PARSED: frozenset({PipelineState.EXTRACTED}),
    PipelineState.EXTRACTED: frozenset({PipelineState.VERIFIED}),
    PipelineState.VERIFIED: frozenset({PipelineState.VALIDATED}),
    PipelineState.VALIDATED: frozenset({PipelineState.NORMALISED}),
    PipelineState.NORMALISED: frozenset({PipelineState.SCORED}),
    PipelineState.SCORED: frozenset({PipelineState.PUBLISHED, PipelineState.NEEDS_REVIEW}),
    PipelineState.NEEDS_REVIEW: frozenset({PipelineState.PUBLISHED}),
    PipelineState.CLASS_UNRESOLVED: frozenset({PipelineState.NEEDS_REVIEW}),
    PipelineState.NO_DOCUMENT: frozenset({PipelineState.NEEDS_REVIEW}),
    PipelineState.UNPARSEABLE: frozenset({PipelineState.NEEDS_REVIEW}),
    PipelineState.PUBLISHED: frozenset(),
}


def legal_next_states(current: PipelineState) -> frozenset[PipelineState]:
    return _TRANSITIONS[current]


def transition(current: PipelineState, target: PipelineState) -> PipelineState:
    """Returns `target` if the move is legal; raises `InvariantViolation` otherwise.
    Callers persist the *return value*, not `target` directly, so a caller can never
    accidentally skip this check by assigning the target state itself."""
    if target not in _TRANSITIONS[current]:
        raise InvariantViolation(f"Illegal pipeline transition: {current.value} -> {target.value}")
    return target
