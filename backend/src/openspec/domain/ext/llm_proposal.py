"""Typed schema for an LLM-grounded extractor's structured output (M3,
`docs/10-roadmap.md` M3 §5). The model is asked to do exactly one thing: point at a
span of the supplied region text, or say it isn't there. It never returns the value
itself as free text — `application/usecases/extract_attribute.py` derives `value_raw`
by slicing the region text at the model's own claimed offsets
(`domain/ext/candidate_builder.py:build_document_span_candidate`), so a model cannot
propose a value that isn't a literal, checkable substring of what it was given
(`docs/10-roadmap.md` M3 §2's "mandatory verbatim spans", enforced by the schema
shape itself, not by a downstream check that could be skipped).

A frozen dataclass with hand-written validation, not `pydantic.BaseModel` — see
`domain/ver/llm_verdict.py`'s docstring for why (a real, checked incompatibility
between `BaseModel` subclassing and this project's `disallow_any_explicit` mypy
override for `domain/`, not a style choice). `_ALLOWED_KEYS` is this file's version
of that module's "no field to smuggle a canonical/normalised/'corrected' value
through" guarantee.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

_ALLOWED_KEYS_FOUND: frozenset[str] = frozenset({"found", "char_start", "char_end", "rationale"})
_ALLOWED_KEYS_NOT_FOUND: frozenset[str] = frozenset({"found", "rationale"})


@dataclass(frozen=True, slots=True)
class ExtractorProposalPayload:
    found: bool
    char_start: int | None
    char_end: int | None
    rationale: str


def _valid_rationale(raw: object) -> str | None:
    if not isinstance(raw, str) or not raw.strip():
        return None
    return raw


def parse_extractor_response(raw_text: str) -> ExtractorProposalPayload | None:
    """`None` for anything that isn't exactly this shape — see
    `domain/ver/llm_verdict.py:parse_verifier_response` for the identical discipline
    on the verification side."""
    try:
        parsed = json.loads(raw_text)
    except (json.JSONDecodeError, ValueError):
        return None
    if not isinstance(parsed, dict):
        return None

    found = parsed.get("found")
    if not isinstance(found, bool):
        return None

    if found:
        if set(parsed.keys()) != _ALLOWED_KEYS_FOUND:
            return None
        char_start = parsed["char_start"]
        char_end = parsed["char_end"]
        if not isinstance(char_start, int) or isinstance(char_start, bool) or char_start < 0:
            return None
        if not isinstance(char_end, int) or isinstance(char_end, bool) or char_end < 0:
            return None
        if char_end <= char_start:
            return None
        rationale = _valid_rationale(parsed.get("rationale"))
        if rationale is None:
            return None
        return ExtractorProposalPayload(
            found=True, char_start=char_start, char_end=char_end, rationale=rationale
        )

    if set(parsed.keys()) != _ALLOWED_KEYS_NOT_FOUND:
        return None
    rationale = _valid_rationale(parsed.get("rationale"))
    if rationale is None:
        return None
    return ExtractorProposalPayload(
        found=False, char_start=None, char_end=None, rationale=rationale
    )
