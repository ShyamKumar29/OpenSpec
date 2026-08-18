"""Multi-candidate conflict detection (`VER`, M3 §10 adversarial case #7: "Two
values conflict"). Pure: given every candidate proposed for one attribute (possibly
from different evidence sources — a document span and a corroborating row field,
say), report whether they actually agree.
"""

from __future__ import annotations

from openspec.domain.model.extraction import ExtractionCandidate


def distinct_proposed_values(candidates: tuple[ExtractionCandidate, ...]) -> tuple[str, ...]:
    """Every distinct `value_raw` among `candidates`, in first-seen order. A result
    of length > 1 is a genuine conflict — two independently-sourced candidates
    disagree about this attribute's value. The caller (`application/usecases/
    verify_extraction.py`) treats that as grounds for `Unknown(CONFLICTING_SOURCES)`
    — never an arbitrary pick between them, and never a silent majority vote that
    would hide the disagreement."""
    seen: list[str] = []
    for candidate in candidates:
        if candidate.value_raw not in seen:
            seen.append(candidate.value_raw)
    return tuple(seen)
