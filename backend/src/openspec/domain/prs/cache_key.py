"""Parse cache key (`docs/04-data-model.md` §3.3: "**Cache key = (content_hash,
parser_version)**. Parser upgrade produces a new artifact; old evidence still
resolves" and M2 brief §7: "Determine from the docs: cache key... Do not invent a
second caching system"). Pure value object + deterministic string form — the actual
cache store lives behind `application/ports/parse_cache.py`.
"""

from __future__ import annotations

from dataclasses import dataclass

from openspec.domain.errors import InvariantViolation


@dataclass(frozen=True, slots=True)
class ParseCacheKey:
    """`content_hash` identifies the exact bytes (`DocumentVersion.content_hash`,
    itself content-addressed per `docs/04-data-model.md` §3.3); `parser_name` +
    `parser_version` identify the code that produced the artifact. Same key => same
    artifact, deterministically — this is what makes "parse once, reference many
    times" (ADR-0005's caching mitigation) correct rather than just fast."""

    content_hash: str
    parser_name: str
    parser_version: str

    def __post_init__(self) -> None:
        if not self.content_hash:
            raise InvariantViolation("ParseCacheKey.content_hash must be non-empty")
        if not self.parser_name or not self.parser_version:
            raise InvariantViolation("ParseCacheKey.parser_name/parser_version must be non-empty")

    def as_string(self) -> str:
        """A single deterministic string suitable as a dict/blob-store key. Not a
        hash of itself — the three fields are already short, stable identifiers, and
        keeping them legible in the key (rather than digesting them) makes a cache
        listing self-explanatory during debugging."""
        return f"{self.content_hash}:{self.parser_name}:{self.parser_version}"
