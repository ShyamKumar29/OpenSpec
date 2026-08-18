"""`InMemoryParseCache` — the dev/test `ParseCacheRepository` adapter (mirrors
`infrastructure/memory/repositories.py`'s established role: "fast, free,
deterministic dev/test adapter", `docs/05-backend.md` §10 recommendation 3, applied
here to the parse cache rather than the LLM port or persistence). A Postgres-backed
`parse_artifact` table implementation (`docs/04-data-model.md` §3.3) is the
production target; this is the composition-root default until one exists.
"""

from __future__ import annotations

from openspec.domain.model.document import ParseArtifact
from openspec.domain.prs.cache_key import ParseCacheKey


class InMemoryParseCache:
    def __init__(self) -> None:
        self._store: dict[str, ParseArtifact] = {}

    def get(self, *, key: ParseCacheKey) -> ParseArtifact | None:
        return self._store.get(key.as_string())

    def put(self, *, key: ParseCacheKey, artifact: ParseArtifact) -> None:
        self._store[key.as_string()] = artifact

    def invalidate(self, *, key: ParseCacheKey) -> None:
        self._store.pop(key.as_string(), None)
