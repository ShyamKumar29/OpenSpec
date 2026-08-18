"""Tests for `domain/nrm/pressure.py` (UH4 — docs/domain/pvf-reference.md
§6, NRM-17 — the non-derivation rule)."""

from __future__ import annotations

from fractions import Fraction

import pytest

from openspec.domain.errors import InvariantViolation
from openspec.domain.nrm.pressure import (
    PressureMedia,
    PressureRating,
    compare_same_basis,
    is_rating_complete,
)


class TestPressureRating:
    def test_no_class_conversion_methods_exist(self) -> None:
        """NRM-17: ANSI Class may never be derived from WOG, and vice versa —
        enforced by the type simply not offering a way to do it."""
        rating = PressureRating(Fraction(600), "psi", PressureMedia.WOG)
        assert not hasattr(rating, "to_ansi_class")
        assert not hasattr(rating, "to_wsp")
        assert not hasattr(rating, "to_wog")

    def test_negative_magnitude_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            PressureRating(Fraction(-1), "psi", PressureMedia.WOG)

    def test_blank_unit_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            PressureRating(Fraction(600), " ", PressureMedia.WOG)

    def test_media_are_distinct_values(self) -> None:
        assert {PressureMedia.WOG, PressureMedia.WSP, PressureMedia.CWP} == {
            PressureMedia.WOG,
            PressureMedia.WSP,
            PressureMedia.CWP,
        }


class TestCompareSameBasis:
    def test_same_media_and_unit_compares_normally(self) -> None:
        a = PressureRating(Fraction(600), "psi", PressureMedia.WOG)
        b = PressureRating(Fraction(300), "psi", PressureMedia.WOG)
        assert compare_same_basis(a, b) == 1

    def test_different_media_never_compared(self) -> None:
        """`600 WOG` vs `150 WSP` — different bases, per §6's own worked
        example. Must return `None`, never a number."""
        wog = PressureRating(Fraction(600), "psi", PressureMedia.WOG)
        wsp = PressureRating(Fraction(150), "psi", PressureMedia.WSP)
        assert compare_same_basis(wog, wsp) is None

    def test_different_unit_never_compared(self) -> None:
        psi = PressureRating(Fraction(600), "psi", PressureMedia.WOG)
        bar = PressureRating(Fraction(40), "bar", PressureMedia.WOG)
        assert compare_same_basis(psi, bar) is None

    def test_equal_ratings(self) -> None:
        a = PressureRating(Fraction(600), "psi", PressureMedia.WOG)
        b = PressureRating(Fraction(600), "psi", PressureMedia.WOG)
        assert compare_same_basis(a, b) == 0


class TestIsRatingComplete:
    def test_no_qualifier_required_is_always_complete(self) -> None:
        rating = PressureRating(Fraction(600), "psi", PressureMedia.WOG)
        assert is_rating_complete(rating, requires_temperature_qualifier=False)

    def test_qualifier_required_but_missing_is_incomplete(self) -> None:
        """PRS-017: PVC/CPVC ratings require a temperature qualifier."""
        rating = PressureRating(Fraction(235), "psi", PressureMedia.WOG)
        assert not is_rating_complete(rating, requires_temperature_qualifier=True)

    def test_qualifier_required_and_present_is_complete(self) -> None:
        rating = PressureRating(
            Fraction(235), "psi", PressureMedia.WOG, temperature_qualifier=Fraction(73)
        )
        assert is_rating_complete(rating, requires_temperature_qualifier=True)
