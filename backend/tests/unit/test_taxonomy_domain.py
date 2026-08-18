"""Domain-layer tests for `domain/model/taxonomy.py` (UH3 —
docs/16-unilog-alignment.md UH3, ADR-0014). Pure, no fixtures beyond literals.
"""

from __future__ import annotations

import pytest

from openspec.domain.errors import InvariantViolation
from openspec.domain.model.taxonomy import (
    CanonicalValueMapping,
    CategoryScopeRule,
    LovAttributeDefinition,
    LovClasspath,
    LovRow,
    ProductCategory,
    build_attribute_definitions,
    classify_category,
    index_canonical_values,
)


class TestLovClasspath:
    def test_parse_splits_on_gt(self) -> None:
        cp = LovClasspath.parse("Plumbing & HVAC>Fittings>Copper Fittings")
        assert cp.segments == ("Plumbing & HVAC", "Fittings", "Copper Fittings")

    def test_render_round_trips(self) -> None:
        raw = "Plumbing & HVAC>Fittings"
        assert LovClasspath.parse(raw).render() == raw

    def test_empty_raises(self) -> None:
        with pytest.raises(InvariantViolation):
            LovClasspath(())

    def test_blank_segment_raises(self) -> None:
        with pytest.raises(InvariantViolation):
            LovClasspath(("Fittings", "  "))

    def test_is_under_true_for_ancestor(self) -> None:
        child = LovClasspath.parse("Plumbing & HVAC>Fittings>Copper Fittings")
        parent = LovClasspath.parse("Plumbing & HVAC>Fittings")
        assert child.is_under(parent)

    def test_is_under_true_for_self(self) -> None:
        cp = LovClasspath.parse("Plumbing & HVAC>Fittings")
        assert cp.is_under(cp)

    def test_is_under_false_for_sibling(self) -> None:
        a = LovClasspath.parse("Plumbing & HVAC>Faucets")
        b = LovClasspath.parse("Plumbing & HVAC>Fittings")
        assert not a.is_under(b)

    def test_is_under_no_false_positive_on_substring(self) -> None:
        """`Faucet Fittings` must not match under `Fittings` just because the
        rendered string contains it — segment equality, not substring."""
        a = LovClasspath.parse("Plumbing>Faucet Fittings")
        b = LovClasspath.parse("Plumbing>Fittings")
        assert not a.is_under(b)

    def test_is_under_false_when_prefix_longer(self) -> None:
        short = LovClasspath.parse("Plumbing")
        long_ = LovClasspath.parse("Plumbing>Fittings>Copper")
        assert not short.is_under(long_)


class TestClassifyCategory:
    def test_no_rules_returns_none(self) -> None:
        cp = LovClasspath.parse("Plumbing>Fittings>Copper")
        assert classify_category(cp, ()) is None

    def test_matching_prefix_returns_category(self) -> None:
        rules = (
            CategoryScopeRule(
                category=ProductCategory.FITTINGS,
                classpath_prefix=LovClasspath.parse("Plumbing>Fittings"),
            ),
        )
        cp = LovClasspath.parse("Plumbing>Fittings>Copper")
        assert classify_category(cp, rules) == ProductCategory.FITTINGS

    def test_non_matching_prefix_returns_none(self) -> None:
        rules = (
            CategoryScopeRule(
                category=ProductCategory.FAUCETS,
                classpath_prefix=LovClasspath.parse("Plumbing>Faucets"),
            ),
        )
        cp = LovClasspath.parse("Plumbing>Fittings>Copper")
        assert classify_category(cp, rules) is None

    def test_first_matching_rule_wins(self) -> None:
        cp = LovClasspath.parse("Plumbing>Fittings>Copper")
        rules = (
            CategoryScopeRule(
                category=ProductCategory.FAUCETS, classpath_prefix=LovClasspath.parse("Plumbing")
            ),
            CategoryScopeRule(
                category=ProductCategory.FITTINGS,
                classpath_prefix=LovClasspath.parse("Plumbing>Fittings"),
            ),
        )
        assert classify_category(cp, rules) == ProductCategory.FAUCETS


class TestLovRow:
    def _row(self, **overrides: object) -> LovRow:
        defaults: dict[str, object] = dict(
            classpath=LovClasspath.parse("Plumbing>Fittings"),
            leaf_node="Copper Fittings",
            filtering=True,
            attribute_label="Connection Type",
            attribute_value_raw="Sweat",
            normalized_label="Connection Type",
            normalized_value="SOLDER",
            guidelines="",
            remarks="",
        )
        defaults.update(overrides)
        return LovRow(**defaults)  # type: ignore[arg-type]

    def test_valid_row_constructs(self) -> None:
        row = self._row()
        assert row.normalized_value == "SOLDER"

    def test_blank_attribute_label_raises(self) -> None:
        with pytest.raises(InvariantViolation):
            self._row(attribute_label="  ")

    def test_blank_normalized_label_raises(self) -> None:
        with pytest.raises(InvariantViolation):
            self._row(normalized_label="")


class TestBuildAttributeDefinitions:
    def test_groups_by_classpath_and_label(self) -> None:
        cp = LovClasspath.parse("Plumbing>Fittings")
        rows = (
            LovRow(
                classpath=cp,
                leaf_node="Copper Fittings",
                filtering=True,
                attribute_label="Connection Type",
                attribute_value_raw="Sweat",
                normalized_label="Connection Type",
                normalized_value="SOLDER",
                guidelines="",
                remarks="",
            ),
            LovRow(
                classpath=cp,
                leaf_node="Copper Fittings",
                filtering=True,
                attribute_label="Connection Type",
                attribute_value_raw="FIP",
                normalized_label="Connection Type",
                normalized_value="NPT_FEMALE",
                guidelines="",
                remarks="",
            ),
            LovRow(
                classpath=cp,
                leaf_node="Copper Fittings",
                filtering=False,
                attribute_label="Material",
                attribute_value_raw="Cu",
                normalized_label="Material",
                normalized_value="COPPER",
                guidelines="",
                remarks="",
            ),
        )
        defs = build_attribute_definitions(rows)
        assert len(defs) == 2
        by_label = {d.attribute_label: d for d in defs}
        assert by_label["Connection Type"].allowed_normalized_values == {"SOLDER", "NPT_FEMALE"}
        assert by_label["Material"].allowed_normalized_values == {"COPPER"}
        assert by_label["Connection Type"].filtering is True

    def test_deterministic_order_is_first_seen(self) -> None:
        cp = LovClasspath.parse("Plumbing>Fittings")

        def row(label: str) -> LovRow:
            return LovRow(
                classpath=cp,
                leaf_node="x",
                filtering=False,
                attribute_label=label,
                attribute_value_raw="v",
                normalized_label=label,
                normalized_value="V",
                guidelines="",
                remarks="",
            )

        defs = build_attribute_definitions((row("B"), row("A"), row("B")))
        assert [d.attribute_label for d in defs] == ["B", "A"]

    def test_empty_input_returns_empty(self) -> None:
        assert build_attribute_definitions(()) == ()

    def test_attribute_with_no_normalized_values_is_free_text(self) -> None:
        cp = LovClasspath.parse("Plumbing>Fittings")
        row = LovRow(
            classpath=cp,
            leaf_node="x",
            filtering=False,
            attribute_label="Notes",
            attribute_value_raw="",
            normalized_label="Notes",
            normalized_value="",
            guidelines="",
            remarks="",
        )
        defs = build_attribute_definitions((row,))
        assert defs[0].allowed_normalized_values == frozenset()


class TestCanonicalValueMapping:
    def test_valid_mapping_constructs(self) -> None:
        m = CanonicalValueMapping(
            category=ProductCategory.FITTINGS,
            attribute_label="Connection Type",
            variant_value="Sweat",
            canonical_value="SOLDER",
        )
        assert m.canonical_value == "SOLDER"

    def test_blank_variant_raises(self) -> None:
        with pytest.raises(InvariantViolation):
            CanonicalValueMapping(
                category=ProductCategory.FITTINGS,
                attribute_label="Connection Type",
                variant_value="  ",
                canonical_value="SOLDER",
            )

    def test_blank_canonical_raises(self) -> None:
        with pytest.raises(InvariantViolation):
            CanonicalValueMapping(
                category=ProductCategory.FITTINGS,
                attribute_label="Connection Type",
                variant_value="Sweat",
                canonical_value=" ",
            )


class TestIndexCanonicalValues:
    def test_lookup_by_category_label_variant(self) -> None:
        mappings = (
            CanonicalValueMapping(
                category=ProductCategory.FITTINGS,
                attribute_label="Connection Type",
                variant_value="Sweat",
                canonical_value="SOLDER",
            ),
            CanonicalValueMapping(
                category=ProductCategory.FITTINGS,
                attribute_label="Connection Type",
                variant_value="CxC",
                canonical_value="SOLDER",
            ),
        )
        index = index_canonical_values(mappings)
        assert index[(ProductCategory.FITTINGS, "Connection Type", "Sweat")] == "SOLDER"
        assert index[(ProductCategory.FITTINGS, "Connection Type", "CxC")] == "SOLDER"
        assert (ProductCategory.FITTINGS, "Connection Type", "Unknown") not in index


def test_lov_attribute_definition_is_frozen() -> None:
    d = LovAttributeDefinition(
        classpath=LovClasspath.parse("Plumbing>Fittings"),
        attribute_label="Material",
        normalized_label="Material",
        filtering=False,
        allowed_normalized_values=frozenset({"COPPER"}),
    )
    with pytest.raises(AttributeError):
        d.attribute_label = "Other"  # type: ignore[misc]
