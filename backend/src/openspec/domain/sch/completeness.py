"""Attribute-completeness computation (`SCH`, M1 — docs/10-roadmap.md M1 lists
"completeness computation" as part of SCH's deliverable). Pure: a fold over
already-materialised `AttributeValue`s, no I/O (INV-6).

Moved here from `infrastructure/memory/repositories.py`, where it was a
private (`_completeness`), untested helper embedded in a dev/test repository
adapter — the wrong layer for a pure computation the API contract
(`docs/api.md` §Records `completeness` object) depends on. Extracting it
makes the rule independently unit-testable and reusable by any future
`RecordRepository` implementation (e.g. a Postgres-backed one), not just the
in-memory demo fixture.
"""

from __future__ import annotations

from dataclasses import dataclass

from openspec.domain.model.attribute import AttributeValue, AttributeValueStatus, is_unknown


@dataclass(frozen=True, slots=True)
class Completeness:
    """`GET /records/{id}`'s `completeness` object (docs/api.md §Records):
    how many of a record's mandatory attributes are filled, and at what
    status. `mandatory_total` is the count of attribute values actually
    passed in — callers scope `values` to mandatory attributes only before
    calling `compute_completeness`, mirroring the existing call sites in
    `infrastructure/memory/repositories.py`."""

    mandatory_total: int
    filled: int
    accepted: int
    pending_review: int
    unknown: int


def compute_completeness(values: tuple[AttributeValue, ...]) -> Completeness:
    """`filled` = has any value at all (accepted, pending review/approval, or
    superseded) — i.e. not `Unknown`. `pending_review` covers both
    `NEEDS_REVIEW` and `NEEDS_APPROVAL` (Tier-0's own pending state, INV-9) —
    the API contract's single `pending_review` counter deliberately doesn't
    split them further (docs/api.md §Records)."""
    filled = sum(1 for v in values if not is_unknown(v))
    accepted = sum(1 for v in values if v.status is AttributeValueStatus.ACCEPTED)
    pending = sum(
        1
        for v in values
        if v.status in (AttributeValueStatus.NEEDS_REVIEW, AttributeValueStatus.NEEDS_APPROVAL)
    )
    unknown = sum(1 for v in values if is_unknown(v))
    return Completeness(
        mandatory_total=len(values),
        filled=filled,
        accepted=accepted,
        pending_review=pending,
        unknown=unknown,
    )
