"""M1 additions to `SCH` test coverage (docs/10-roadmap.md M1's own SCH test
checklist: "ambiguous class", "invalid class/schema combination", "risk-tier
propagation", "required attribute propagation") that `test_resolve_schema.py`
(UH3) didn't already exercise. Reuses UH3's architecture as-is — no new
resolution logic, only new test cases against it, per the M1 brief's "do not
create a second taxonomy system" instruction."""

from __future__ import annotations

from openspec.application.usecases.resolve_schema import (
    SchemaBlocked,
    SchemaResolved,
    resolve_schema_for_classpath,
)
from openspec.domain.model.taxonomy import (
    CategoryScopeRule,
    LovAttributeDefinition,
    LovClasspath,
    ProductCategory,
    classify_category,
)
from openspec.domain.sch.schema_engine import RiskTierPolicy

_POLICY = RiskTierPolicy(tier_0_keywords=frozenset({"pressure"}), default_tier=1)
_FITTINGS_CP = LovClasspath.parse("Plumbing>Fittings>Copper Fittings")


class _FakeTaxonomyReference:
    def __init__(self, definitions: tuple[LovAttributeDefinition, ...]) -> None:
        self._definitions = definitions

    def attribute_definitions(self, classpath: LovClasspath) -> tuple[LovAttributeDefinition, ...]:
        return tuple(d for d in self._definitions if d.classpath == classpath)

    def all_classpaths(self) -> tuple[LovClasspath, ...]:
        return tuple({d.classpath for d in self._definitions})


def test_ambiguous_scope_rules_resolve_deterministically_to_first_match() -> None:
    """Two overlapping `CategoryScopeRule`s could plausibly both claim the
    same classpath (a config mistake, not a real-world impossibility) — this
    proves `classify_category` never picks arbitrarily: the earlier rule in
    the tuple always wins, deterministically, every call."""
    ambiguous_rules = (
        CategoryScopeRule(
            category=ProductCategory.FITTINGS, classpath_prefix=LovClasspath.parse("Plumbing")
        ),
        CategoryScopeRule(
            category=ProductCategory.FAUCETS, classpath_prefix=LovClasspath.parse("Plumbing")
        ),
    )
    result_a = classify_category(_FITTINGS_CP, ambiguous_rules)
    result_b = classify_category(_FITTINGS_CP, ambiguous_rules)
    assert result_a == ProductCategory.FITTINGS
    assert result_a == result_b  # deterministic, not a coin flip


def test_invalid_class_schema_combination_is_blocked_not_asserted() -> None:
    """A classpath that is in scope for one category, but whose only
    available attribute definitions belong to a *different* classpath (a
    reference-data mismatch — the "invalid class/schema combination" case),
    must resolve to zero attributes and an explicit `SchemaBlocked`, never a
    schema silently built from the wrong class's attributes."""
    scope_rules = (
        CategoryScopeRule(
            category=ProductCategory.FITTINGS,
            classpath_prefix=LovClasspath.parse("Plumbing>Fittings"),
        ),
    )
    mismatched_definitions = (
        LovAttributeDefinition(
            classpath=LovClasspath.parse(
                "Plumbing>Fittings>Brass Fittings"
            ),  # a *different* classpath
            attribute_label="Connection Type",
            normalized_label="Connection Type",
            filtering=True,
            allowed_normalized_values=frozenset(),
        ),
    )
    result = resolve_schema_for_classpath(
        classpath=_FITTINGS_CP,
        scope_rules=scope_rules,
        taxonomy=_FakeTaxonomyReference(mismatched_definitions),
        risk_policy=_POLICY,
    )
    assert isinstance(result, SchemaBlocked)
    assert "NO_ATTRIBUTE_DEFINITIONS" in result.reason


def test_required_attribute_propagation_through_to_attribute_refs() -> None:
    """`is_mandatory` on every LOV-sourced attribute is `False` by design
    (`domain/sch/schema_engine.py`'s own documented gap — the LOV's
    `Filtering Y/N` column is a faceted-search flag, not mandatoriness).
    This test pins that propagation explicitly so a future session that
    wires a real mandatory-attribute source doesn't silently break it."""
    scope_rules = (
        CategoryScopeRule(
            category=ProductCategory.FITTINGS,
            classpath_prefix=LovClasspath.parse("Plumbing>Fittings"),
        ),
    )
    definitions = (
        LovAttributeDefinition(
            classpath=_FITTINGS_CP,
            attribute_label="Connection Type",
            normalized_label="Connection Type",
            filtering=True,
            allowed_normalized_values=frozenset({"SOLDER"}),
        ),
    )
    result = resolve_schema_for_classpath(
        classpath=_FITTINGS_CP,
        scope_rules=scope_rules,
        taxonomy=_FakeTaxonomyReference(definitions),
        risk_policy=_POLICY,
    )
    assert isinstance(result, SchemaResolved)
    assert all(a.is_mandatory is False for a in result.attributes)
