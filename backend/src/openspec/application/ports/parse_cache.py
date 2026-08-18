"""`ParseCacheRepository` — the PRS cache port (M2 brief §7: "Do not invent a second
caching system. Cache parsed representation rather than arbitrary application
state."). Keyed by `domain/prs/cache_key.py::ParseCacheKey`
(`content_hash` + `parser_name` + `parser_version`), storing the same
`ParseArtifact` a fresh parse would produce — a hit and a miss-then-parse are
observationally identical to every caller except for latency.
"""

from __future__ import annotations

from typing import Protocol

from openspec.domain.model.document import ParseArtifact
from openspec.domain.prs.cache_key import ParseCacheKey


class ParseCacheRepository(Protocol):
    def get(self, *, key: ParseCacheKey) -> ParseArtifact | None:
        """`None` is a genuine cache miss — never distinguished from "known bad",
        because a failed parse is never cached as a success (see
        `application/usecases/parse_document.py`: `ParseFailed` outcomes are not
        written here at all, so a retried parse always gets a fresh attempt)."""
        ...

    def put(self, *, key: ParseCacheKey, artifact: ParseArtifact) -> None: ...

    def invalidate(self, *, key: ParseCacheKey) -> None:
        """Explicit invalidation for a parser upgrade or corrupt-cache recovery
        (M2 brief §7: 'corrupt/invalid cache handling'). Safe to call on a key
        that was never cached."""
        ...
