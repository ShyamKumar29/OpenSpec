"""Tests for `infrastructure/parsing/parse_cache.py` — proves cache hit, miss,
invalidation, and that a distinct key (e.g. a parser version bump) never collides
with a previously cached artifact (M2 brief §7)."""

from __future__ import annotations

from openspec.domain.model.document import ParseArtifact
from openspec.domain.prs.cache_key import ParseCacheKey
from openspec.infrastructure.parsing.parse_cache import InMemoryParseCache

_KEY = ParseCacheKey(content_hash="sha256_abc", parser_name="pdfplumber", parser_version="0.11")
_ARTIFACT = ParseArtifact(
    id="artifact_1",
    document_version_id="v1",
    parser_name="pdfplumber",
    parser_version="0.11",
    parse_quality=1.0,
    has_text_layer=True,
    used_ocr=False,
    regions=(),
)


def test_miss_returns_none() -> None:
    cache = InMemoryParseCache()
    assert cache.get(key=_KEY) is None


def test_put_then_get_is_a_hit() -> None:
    cache = InMemoryParseCache()
    cache.put(key=_KEY, artifact=_ARTIFACT)
    assert cache.get(key=_KEY) == _ARTIFACT


def test_invalidate_clears_a_previously_cached_entry() -> None:
    cache = InMemoryParseCache()
    cache.put(key=_KEY, artifact=_ARTIFACT)
    cache.invalidate(key=_KEY)
    assert cache.get(key=_KEY) is None


def test_invalidate_on_an_uncached_key_is_a_safe_no_op() -> None:
    cache = InMemoryParseCache()
    cache.invalidate(key=_KEY)  # never cached — must not raise
    assert cache.get(key=_KEY) is None


def test_a_different_parser_version_is_a_different_cache_entry() -> None:
    cache = InMemoryParseCache()
    cache.put(key=_KEY, artifact=_ARTIFACT)
    other_key = ParseCacheKey(
        content_hash="sha256_abc", parser_name="pdfplumber", parser_version="0.12"
    )
    assert cache.get(key=other_key) is None
    assert cache.get(key=_KEY) == _ARTIFACT  # original entry untouched
