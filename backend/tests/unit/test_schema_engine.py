"""Tests for `domain/sch/schema_engine.py` (UH3 —
docs/16-unilog-alignment.md UH3)."""

from __future__ import annotations

import pytest

from openspec.domain.model.taxonomy import LovAttributeDefinition, LovClasspath
from openspec.domain.sch.schema_engine import (
    RiskTierPolicy,
    assign_risk_tier,
    build_schema,
    to_attribute_ref,
)

_POLICY = RiskTierPolicy(
    tier_0_keywords=frozenset({"pressure", "temperature", "class", "compliance"}),
    default_tier=1,
)


class TestRiskTierPolicy:
    def test_rejects_out_of_range_default_tier(self) -> None:
        with pytest.raises(ValueError):
            RiskTierPolicy(tier_0_keywords=frozenset(), default_tier=4)


class TestAssignRiskTier:
    @pytest.mark.parametrize(
        "label",
        ["Pressure Rating (WOG)", "Max Temperature", "ANSI Class", "Lead-Free Compliance"],
    )
    def test_tier0_keywords_match_case_insensitively(self, label: str) -> None:
        assert assign_risk_tier(label, _POLICY) == 0

    def test_non_matching_label_gets_default_tier(self) -> None:
        assert assign_risk_tier("Connection Type", _POLICY) == 1

    def test_empty_keyword_set_always_default(self) -> None:
        policy = RiskTierPolicy(tier_0_keywords=frozenset(), default_tier=2)
        assert assign_risk_tier("Pressure Rating", policy) == 2


class TestToAttributeRef:
    def test_enum_datatype_when_allowed_values_present(self) -> None:
        d = LovAttributeDefinition(
            classpath=LovClasspath.parse("Plumbing>Fittings"),
            attribute_label="Connection Type",
            normalized_label="Connection Type",
            filtering=True,
            allowed_normalized_values=frozenset({"SOLDER", "NPT_FEMALE"}),
        )
        ref = to_attribute_ref(d, _POLICY)
        assert ref.datatype == "enum"
        assert ref.code == "connection_type"
        assert ref.risk_tier == 1
        assert ref.is_mandatory is False

    def test_string_datatype_when_no_allowed_values(self) -> None:
        d = LovAttributeDefinition(
            classpath=LovClasspath.parse("Plumbing>Fittings"),
            attribute_label="Notes",
            normalized_label="Notes",
            filtering=False,
            allowed_normalized_values=frozenset(),
        )
        ref = to_attribute_ref(d, _POLICY)
        assert ref.datatype == "string"

    def test_tier0_label_becomes_tier0_attribute_ref(self) -> None:
        d = LovAttributeDefinition(
            classpath=LovClasspath.parse("Plumbing>Fittings"),
            attribute_label="Pressure Rating (WOG)",
            normalized_label="Pressure Rating (WOG)",
            filtering=False,
            allowed_normalized_values=frozenset(),
        )
        ref = to_attribute_ref(d, _POLICY)
        assert ref.risk_tier == 0

    @pytest.mark.parametrize(
        "label,code",
        [
            ("Connection Type", "connection_type"),
            ("Pressure Rating (WOG)", "pressure_rating_wog"),
            ("  Leading/Trailing  ", "leading_trailing"),
            ("Multiple   Spaces", "multiple_spaces"),
        ],
    )
    def test_slugify_forms(self, label: str, code: str) -> None:
        d = LovAttributeDefinition(
            classpath=LovClasspath.parse("Plumbing>Fittings"),
            attribute_label=label,
            normalized_label=label,
            filtering=False,
            allowed_normalized_values=frozenset(),
        )
        assert to_attribute_ref(d, _POLICY).code == code


class TestBuildSchema:
    def test_preserves_input_order(self) -> None:
        cp = LovClasspath.parse("Plumbing>Fittings")
        defs = (
            LovAttributeDefinition(cp, "Material", "Material", False, frozenset()),
            LovAttributeDefinition(cp, "Connection Type", "Connection Type", True, frozenset()),
        )
        attrs = build_schema(defs, _POLICY)
        assert [a.code for a in attrs] == ["material", "connection_type"]

    def test_empty_input_returns_empty(self) -> None:
        assert build_schema((), _POLICY) == ()
