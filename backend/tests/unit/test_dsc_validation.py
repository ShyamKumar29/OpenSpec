"""Tests for `domain/dsc/validation.py` (UH5, ADR-0013). Also cross-checks
`CONFIRMED_FIELD_CONSTRAINTS` against the two real example rows in
`resources/reference/unihack/delivery_format.csv` — not proof the formula is
right (there is none to derive it from), just that the confirmed length/casing
constraints don't contradict the one real data point available.
"""

from __future__ import annotations

from openspec.domain.dsc.validation import (
    constraint_for,
    run_field_validation,
    validate_casing,
    validate_max_length,
    validate_min_length,
    validate_non_empty,
)
from openspec.domain.model.description import Casing
from openspec.infrastructure.reference_data.delivery_format import load_delivery_format_rows


class TestValidateMaxLength:
    def test_within_limit_passes(self) -> None:
        assert validate_max_length("short", max_length=10).passed

    def test_exactly_at_limit_passes(self) -> None:
        assert validate_max_length("1234567890", max_length=10).passed

    def test_over_limit_fails(self) -> None:
        assert not validate_max_length("12345678901", max_length=10).passed


class TestValidateMinLength:
    def test_at_or_above_minimum_passes(self) -> None:
        assert validate_min_length("1234567890", min_length=10).passed

    def test_below_minimum_fails(self) -> None:
        assert not validate_min_length("123", min_length=10).passed


class TestValidateCasing:
    def test_all_caps_passes_upper_requirement(self) -> None:
        assert validate_casing("DISHWASHER 120V", required=Casing.UPPER).passed

    def test_mixed_case_fails_upper_requirement(self) -> None:
        assert not validate_casing("Dishwasher 120V", required=Casing.UPPER).passed

    def test_digits_and_punctuation_ignored_for_casing(self) -> None:
        assert validate_casing("120V 15A", required=Casing.UPPER).passed

    def test_as_is_always_passes(self) -> None:
        assert validate_casing("Mixed Case", required=Casing.AS_IS).passed


class TestValidateNonEmpty:
    def test_non_blank_passes(self) -> None:
        assert validate_non_empty("x").passed

    def test_blank_fails(self) -> None:
        assert not validate_non_empty("   ").passed


class TestConfirmedFieldConstraints:
    def test_invoice_desc_is_40_char_caps(self) -> None:
        c = constraint_for("INVOICE_DESC")
        assert c is not None
        assert c.max_length == 40
        assert c.required_casing is Casing.UPPER

    def test_mobile_desc_is_60_to_80_char(self) -> None:
        c = constraint_for("MOBILE_DESC")
        assert c is not None
        assert c.min_length == 60
        assert c.max_length == 80

    def test_unconstrained_field_returns_none(self) -> None:
        assert constraint_for("SHORT_DESC") is None

    def test_run_field_validation_for_unconstrained_field_only_checks_non_empty(self) -> None:
        results = run_field_validation("anything", "SHORT_DESC")
        assert [r.rule_id for r in results] == ["DSC-NON-EMPTY"]


class TestConfirmedConstraintsAgainstRealExampleRows:
    """Not a formula-correctness test (no formula exists to test) — just
    confirms the two length/casing constraints this project claims don't
    contradict the one real data point available."""

    def test_real_invoice_desc_values_satisfy_the_confirmed_constraint(self) -> None:
        rows = load_delivery_format_rows()
        for row in rows:
            results = run_field_validation(row["INVOICE_DESC"], "INVOICE_DESC")
            assert all(r.passed for r in results), (row["INVOICE_DESC"], results)

    def test_real_mobile_desc_values_satisfy_the_confirmed_constraint(self) -> None:
        rows = load_delivery_format_rows()
        for row in rows:
            results = run_field_validation(row["MOBILE_DESC"], "MOBILE_DESC")
            assert all(r.passed for r in results), (row["MOBILE_DESC"], results)
