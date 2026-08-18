"""Tests for `domain/nrm/fractions.py` (UH4 — docs/domain/pvf-reference.md
§4, CLAUDE.md's fraction domain trap)."""

from __future__ import annotations

from fractions import Fraction

import pytest

from openspec.domain.errors import DomainAbstention
from openspec.domain.nrm.fractions import parse_fraction, render_mixed_fraction


class TestParseFraction:
    @pytest.mark.parametrize(
        "raw",
        ["1-1/4", "1 1/4", "1¼", "1.25"],
    )
    def test_all_documented_equivalent_forms_parse_to_same_value(self, raw: str) -> None:
        assert parse_fraction(raw) == Fraction(5, 4)

    def test_bare_simple_fraction(self) -> None:
        assert parse_fraction("1/2") == Fraction(1, 2)

    def test_bare_unicode_fraction(self) -> None:
        assert parse_fraction("¾") == Fraction(3, 4)

    def test_bare_integer(self) -> None:
        assert parse_fraction("2") == Fraction(2, 1)

    def test_decimal_without_mixed_fraction(self) -> None:
        assert parse_fraction("0.5") == Fraction(1, 2)

    def test_whitespace_is_stripped(self) -> None:
        assert parse_fraction("  1/2  ") == Fraction(1, 2)

    def test_empty_string_abstains(self) -> None:
        with pytest.raises(DomainAbstention) as exc:
            parse_fraction("")
        assert exc.value.reason_code == "NORMALIZATION_FAILED"

    def test_unrecognised_format_abstains(self) -> None:
        with pytest.raises(DomainAbstention) as exc:
            parse_fraction("about one and a half")
        assert exc.value.reason_code == "NORMALIZATION_FAILED"

    def test_zero_denominator_abstains(self) -> None:
        with pytest.raises(DomainAbstention):
            parse_fraction("1/0")

    def test_zero_denominator_in_mixed_form_abstains(self) -> None:
        with pytest.raises(DomainAbstention):
            parse_fraction("1-1/0")

    def test_no_float_used_internally(self) -> None:
        """Regression guard for the exact-rational requirement: a value that
        would lose precision as a float must still round-trip exactly."""
        result = parse_fraction("1/3")
        assert result == Fraction(1, 3)
        assert result.numerator == 1
        assert result.denominator == 3


class TestRenderMixedFraction:
    def test_whole_and_fraction(self) -> None:
        assert render_mixed_fraction(Fraction(5, 4)) == "1-1/4"

    def test_fraction_only(self) -> None:
        assert render_mixed_fraction(Fraction(1, 4)) == "1/4"

    def test_whole_only(self) -> None:
        assert render_mixed_fraction(Fraction(2, 1)) == "2"

    def test_round_trips_through_parse(self) -> None:
        for raw in ("1-1/4", "3/8", "5"):
            assert render_mixed_fraction(parse_fraction(raw)) == raw
