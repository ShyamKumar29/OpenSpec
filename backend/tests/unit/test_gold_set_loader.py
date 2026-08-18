"""`infrastructure/reference_data/gold_set.py` (`EVL`, M1 brief §8:
"unavailable gold set" / valid / malformed)."""

from __future__ import annotations

from pathlib import Path

from openspec.domain.model.gold import GoldSetAvailability
from openspec.infrastructure.reference_data.gold_set import (
    DEFAULT_GOLD_SET_PATH,
    load_gold_set,
)

_FIXTURE_DIR = Path(__file__).resolve().parents[1] / "fixtures" / "evl"


def test_real_shipped_path_is_unavailable() -> None:
    """No real gold set exists in this environment (README.md in the same
    resource directory) — this must stay `GOLD_SET_UNAVAILABLE`, never a
    silent empty success."""
    outcome = load_gold_set(DEFAULT_GOLD_SET_PATH)
    assert outcome.availability is GoldSetAvailability.GOLD_SET_UNAVAILABLE
    assert outcome.gold_set is None
    assert outcome.errors == ()


def test_missing_file_is_unavailable() -> None:
    outcome = load_gold_set(_FIXTURE_DIR / "does_not_exist.csv")
    assert outcome.availability is GoldSetAvailability.GOLD_SET_UNAVAILABLE
    assert outcome.gold_set is None


def test_valid_fixture_is_available() -> None:
    outcome = load_gold_set(_FIXTURE_DIR / "valid_gold_set.csv")
    assert outcome.availability is GoldSetAvailability.GOLD_SET_AVAILABLE
    assert outcome.gold_set is not None
    assert len(outcome.gold_set.labels) == 3
    assert outcome.errors == ()


def test_malformed_fixture_is_invalid() -> None:
    outcome = load_gold_set(_FIXTURE_DIR / "malformed_gold_set.csv")
    assert outcome.availability is GoldSetAvailability.INVALID_GOLD_SET
    assert outcome.gold_set is None
    assert len(outcome.errors) == 1
    assert "DUPLICATE_IDENTIFIER" in outcome.errors[0]


def test_deterministic_repeated_load() -> None:
    a = load_gold_set(_FIXTURE_DIR / "valid_gold_set.csv")
    b = load_gold_set(_FIXTURE_DIR / "valid_gold_set.csv")
    assert a == b
