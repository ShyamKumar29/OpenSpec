"""Tests for `domain/prs/cache_key.py`."""

from __future__ import annotations

import pytest

from openspec.domain.errors import InvariantViolation
from openspec.domain.prs.cache_key import ParseCacheKey


def test_as_string_is_deterministic() -> None:
    k1 = ParseCacheKey(content_hash="sha256_abc", parser_name="pdfplumber", parser_version="0.11")
    k2 = ParseCacheKey(content_hash="sha256_abc", parser_name="pdfplumber", parser_version="0.11")
    assert k1.as_string() == k2.as_string()


def test_different_parser_version_is_a_different_key() -> None:
    k1 = ParseCacheKey(content_hash="sha256_abc", parser_name="pdfplumber", parser_version="0.11")
    k2 = ParseCacheKey(content_hash="sha256_abc", parser_name="pdfplumber", parser_version="0.12")
    assert k1.as_string() != k2.as_string()


def test_different_content_hash_is_a_different_key() -> None:
    k1 = ParseCacheKey(content_hash="sha256_abc", parser_name="pdfplumber", parser_version="0.11")
    k2 = ParseCacheKey(content_hash="sha256_def", parser_name="pdfplumber", parser_version="0.11")
    assert k1.as_string() != k2.as_string()


@pytest.mark.parametrize(
    "kwargs",
    [
        {"content_hash": ""},
        {"parser_name": ""},
        {"parser_version": ""},
    ],
)
def test_blank_field_rejected(kwargs: dict[str, str]) -> None:
    base = {"content_hash": "sha256_abc", "parser_name": "pdfplumber", "parser_version": "0.11"}
    base.update(kwargs)
    with pytest.raises(InvariantViolation):
        ParseCacheKey(**base)
