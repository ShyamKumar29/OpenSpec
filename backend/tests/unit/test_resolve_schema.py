"""Tests for `application/usecases/resolve_schema.py` (`SCH`, UH3 —
docs/16-unilog-alignment.md UH3). Exercises the use case against a fake
`TaxonomyReference` (the standard "unit test with fake ports" pattern,
docs/05-backend.md §2), plus the two honest-blocker paths this environment is
actually in today: out-of-scope classpath and no reference data at all.
"""

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
)
from openspec.domain.sch.schema_engine import RiskTierPolicy

_POLICY = RiskTierPolicy(tier_0_keywords=frozenset({"pressure"}), default_tier=1)
_FITTINGS_CP = LovClasspath.parse("Plumbing>Fittings>Copper Fittings")
_SCOPE_RULES = (
    CategoryScopeRule(
        category=ProductCategory.FITTINGS,
        classpath_prefix=LovClasspath.parse("Plumbing>Fittings"),
    ),
)


class _FakeTaxonomyReference:
    """Fake port — `application/ports/taxonomy.TaxonomyReference` shape,
    no infrastructure dependency."""

    def __init__(self, definitions: tuple[LovAttributeDefinition, ...]) -> None:
        self._definitions = definitions

    def attribute_definitions(self, classpath: LovClasspath) -> tuple[LovAttributeDefinition, ...]:
        return tuple(d for d in self._definitions if d.classpath == classpath)

    def all_classpaths(self) -> tuple[LovClasspath, ...]:
        return tuple({d.classpath for d in self._definitions})


def test_out_of_scope_classpath_is_blocked_before_touching_reference() -> None:
    result = resolve_schema_for_classpath(
        classpath=LovClasspath.parse("Electrical>Lighting"),
        scope_rules=_SCOPE_RULES,
        taxonomy=_FakeTaxonomyReference(()),
        risk_policy=_POLICY,
    )
    assert isinstance(result, SchemaBlocked)
    assert "OUT_OF_SCOPE" in result.reason


def test_no_reference_data_is_blocked_honestly() -> None:
    result = resolve_schema_for_classpath(
        classpath=_FITTINGS_CP,
        scope_rules=_SCOPE_RULES,
        taxonomy=None,
        risk_policy=_POLICY,
    )
    assert isinstance(result, SchemaBlocked)
    assert "REFERENCE_DATA_UNAVAILABLE" in result.reason


def test_in_scope_but_no_rows_for_classpath_is_blocked() -> None:
    result = resolve_schema_for_classpath(
        classpath=_FITTINGS_CP,
        scope_rules=_SCOPE_RULES,
        taxonomy=_FakeTaxonomyReference(()),
        risk_policy=_POLICY,
    )
    assert isinstance(result, SchemaBlocked)
    assert "NO_ATTRIBUTE_DEFINITIONS" in result.reason


def test_resolved_schema_returns_attributes_and_category() -> None:
    definitions = (
        LovAttributeDefinition(
            classpath=_FITTINGS_CP,
            attribute_label="Connection Type",
            normalized_label="Connection Type",
            filtering=True,
            allowed_normalized_values=frozenset({"SOLDER"}),
        ),
        LovAttributeDefinition(
            classpath=_FITTINGS_CP,
            attribute_label="Pressure Rating",
            normalized_label="Pressure Rating",
            filtering=False,
            allowed_normalized_values=frozenset(),
        ),
    )
    result = resolve_schema_for_classpath(
        classpath=_FITTINGS_CP,
        scope_rules=_SCOPE_RULES,
        taxonomy=_FakeTaxonomyReference(definitions),
        risk_policy=_POLICY,
    )
    assert isinstance(result, SchemaResolved)
    assert result.category == ProductCategory.FITTINGS
    codes = {a.code: a.risk_tier for a in result.attributes}
    assert codes["connection_type"] == 1
    assert codes["pressure_rating"] == 0
