"""`domain/ing/mpn.py` (CLAUDE.md: "MPN canonicalisation... use code")."""

from __future__ import annotations

import pytest

from openspec.domain.errors import DomainAbstention
from openspec.domain.ing.mpn import canonicalize_mpn


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("ABC-123", "ABC123"),  # the existing demo fixture's own precedent
        ("XYZ-789", "XYZ789"),
        ("abc123", "ABC123"),
        ("  ABC 123  ", "ABC123"),
        ("A.B/C-1_2", "ABC12"),
    ],
)
def test_canonicalize_mpn(raw: str, expected: str) -> None:
    assert canonicalize_mpn(raw) == expected


def test_blank_mpn_raises_domain_abstention_missing_mpn() -> None:
    with pytest.raises(DomainAbstention) as exc_info:
        canonicalize_mpn("   ")
    assert exc_info.value.reason_code == "MISSING_MPN"


def test_empty_string_raises_domain_abstention() -> None:
    with pytest.raises(DomainAbstention):
        canonicalize_mpn("")


def test_punctuation_only_raises_domain_abstention() -> None:
    with pytest.raises(DomainAbstention):
        canonicalize_mpn("---///")


def test_canonicalization_is_deterministic() -> None:
    assert canonicalize_mpn("Abc-123") == canonicalize_mpn("Abc-123")
