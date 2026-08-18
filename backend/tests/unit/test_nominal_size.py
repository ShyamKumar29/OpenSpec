"""Tests for `domain/nrm/nominal_size.py` (UH4 —
docs/domain/pvf-reference.md §4)."""

from __future__ import annotations

from fractions import Fraction

import pytest

from openspec.domain.errors import InvariantViolation
from openspec.domain.nrm.nominal_size import (
    EMPTY_NPS_DN_EQUIVALENCE,
    NominalSize,
    SizeStandard,
    compare_nominal_sizes,
    nps_to_dn,
)


class TestNominalSize:
    def test_no_conversion_methods_exist(self) -> None:
        """The whole point of this type: there is no way to turn a
        designation into a length."""
        size = NominalSize(standard=SizeStandard.NPS, magnitude=Fraction(1, 2), display="1/2")
        assert not hasattr(size, "to_mm")
        assert not hasattr(size, "to_inches")
        assert not hasattr(size, "to_length")

    def test_zero_magnitude_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            NominalSize(standard=SizeStandard.NPS, magnitude=Fraction(0), display="0")

    def test_negative_magnitude_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            NominalSize(standard=SizeStandard.NPS, magnitude=Fraction(-1), display="-1")

    def test_blank_display_rejected(self) -> None:
        with pytest.raises(InvariantViolation):
            NominalSize(standard=SizeStandard.NPS, magnitude=Fraction(1, 2), display=" ")


class TestCompareNominalSizes:
    def test_same_standard_smaller(self) -> None:
        a = NominalSize(SizeStandard.NPS, Fraction(1, 2), "1/2")
        b = NominalSize(SizeStandard.NPS, Fraction(3, 4), "3/4")
        assert compare_nominal_sizes(a, b) == -1

    def test_same_standard_equal(self) -> None:
        a = NominalSize(SizeStandard.NPS, Fraction(1, 2), "1/2")
        b = NominalSize(SizeStandard.NPS, Fraction(1, 2), "1/2")
        assert compare_nominal_sizes(a, b) == 0

    def test_same_standard_larger(self) -> None:
        a = NominalSize(SizeStandard.NPS, Fraction(1), "1")
        b = NominalSize(SizeStandard.NPS, Fraction(1, 2), "1/2")
        assert compare_nominal_sizes(a, b) == 1

    def test_nps_vs_dn_is_unknown_not_a_number(self) -> None:
        nps = NominalSize(SizeStandard.NPS, Fraction(1, 2), "1/2")
        dn = NominalSize(SizeStandard.DN, Fraction(15), "DN15")
        assert compare_nominal_sizes(nps, dn) is None

    def test_nps_vs_tube_is_never_comparable(self) -> None:
        nps = NominalSize(SizeStandard.NPS, Fraction(1, 2), "1/2")
        tube = NominalSize(SizeStandard.TUBE, Fraction(1, 2), "1/2 OD")
        assert compare_nominal_sizes(nps, tube) is None


class TestNpsDnEquivalence:
    def test_empty_table_ships_by_default(self) -> None:
        """OD-4 (docs/decisions.md) is still open — no primary source has been
        cited for a real NPS<->DN table, so this must stay empty rather than
        silently populated with unverified numbers."""
        assert EMPTY_NPS_DN_EQUIVALENCE == {}

    def test_empty_table_returns_none_for_any_size(self) -> None:
        nps = NominalSize(SizeStandard.NPS, Fraction(1, 2), "1/2")
        assert nps_to_dn(nps, EMPTY_NPS_DN_EQUIVALENCE) is None

    def test_populated_table_is_a_lookup_not_arithmetic(self) -> None:
        table = {Fraction(1, 2): Fraction(15)}
        nps = NominalSize(SizeStandard.NPS, Fraction(1, 2), "1/2")
        assert nps_to_dn(nps, table) == Fraction(15)

    def test_rejects_non_nps_input(self) -> None:
        dn = NominalSize(SizeStandard.DN, Fraction(15), "DN15")
        with pytest.raises(InvariantViolation):
            nps_to_dn(dn, EMPTY_NPS_DN_EQUIVALENCE)
