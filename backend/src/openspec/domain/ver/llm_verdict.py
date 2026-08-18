"""Typed schema for an independent LLM verifier's structured output (M3,
`docs/10-roadmap.md` M3 §5: "require structured output; validate it with typed
schemas; reject malformed output"). A frozen dataclass with hand-written validation
— the same shape every other domain type in this codebase already uses
(`AttributeRef`, `Verification`, `ClassificationCandidate`, ...) — rather than
`pydantic.BaseModel`: `pydantic` is architecturally allowed in `domain/`
(`tests/architecture/test_layering.py`'s `DOMAIN_ALLOWED_THIRD_PARTY`), but
`pyproject.toml`'s `disallow_any_explicit` override for `domain/`/`application/`
(CLAUDE.md: "no `Any` in domain or application") fires on `BaseModel` subclassing
even with the `pydantic.mypy` plugin enabled — a real, checked incompatibility, not
a stylistic choice. Hand-written parsing keeps the same "typed schema, reject
malformed output" guarantee without depending on that combination working.

**`_ALLOWED_KEYS` is the load-bearing set in this file.** The verifier's job is to
judge a candidate the extractor already proposed, never to supply a replacement
value (`docs/10-roadmap.md` M3 §9: "prevent it from inventing a new candidate"). Any
key outside `{"verdict", "rationale"}` — whether from confusion or a prompt-injection
attempt — fails the payload as a whole; it is never partially trusted or ignored.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Literal

VerdictLiteral = Literal["ENTAILED", "PARTIAL", "NOT_ENTAILED"]
_ALLOWED_VERDICTS: frozenset[str] = frozenset({"ENTAILED", "PARTIAL", "NOT_ENTAILED"})
_ALLOWED_KEYS: frozenset[str] = frozenset({"verdict", "rationale"})


@dataclass(frozen=True, slots=True)
class VerifierVerdictPayload:
    """The **only** shape an independent verifier's response may take. `rationale`
    is required and non-empty — an opaque verdict with no stated reasoning is not
    acceptable output (mirrors `ClassificationCandidate.rationale`'s "explainability"
    discipline, `domain/model/classification.py`)."""

    verdict: VerdictLiteral
    rationale: str


def parse_verifier_response(raw_text: str) -> VerifierVerdictPayload | None:
    """`None` for anything that isn't exactly this shape — malformed JSON, a missing
    field, an extra field, an out-of-vocabulary `verdict` token — never an attempt to
    salvage a partial parse. The caller (`application/usecases/verify_extraction.py`)
    treats `None` as "the verifier could not be trusted", not as a specific verdict."""
    try:
        parsed = json.loads(raw_text)
    except (json.JSONDecodeError, ValueError):
        return None
    if not isinstance(parsed, dict):
        return None
    if set(parsed.keys()) != _ALLOWED_KEYS:
        return None

    verdict = parsed["verdict"]
    rationale = parsed["rationale"]
    if not isinstance(verdict, str) or verdict not in _ALLOWED_VERDICTS:
        return None
    if not isinstance(rationale, str) or not rationale.strip():
        return None

    verdict_literal: VerdictLiteral = verdict  # type: ignore[assignment]
    return VerifierVerdictPayload(verdict=verdict_literal, rationale=rationale)
