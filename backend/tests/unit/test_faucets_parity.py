"""UH6 — proves Faucets rides the same `SCH`/`RES`-shaped architecture
Fittings does, with zero new code: the same `resolve_schema_for_classpath`
use case, the same `CanonicalValueLovAdapter`, the same `category_scope.yaml`
shape, configured with a second category's rules instead of a second code
path (ADR-0014's "adding a sixth class is a YAML file, zero code changes"
claim, extended to a second *category* here). Fixture data only — neither
`Fittings_LOV.xlsx` nor `FAUCETS_LOV.xlsx` exists in this environment.
"""

from __future__ import annotations

from openspec.application.usecases.resolve_schema import (
    SchemaResolved,
    resolve_schema_for_classpath,
)
from openspec.domain.model.taxonomy import (
    CanonicalValueMapping,
    CategoryScopeRule,
    LovAttributeDefinition,
    LovClasspath,
    ProductCategory,
)
from openspec.domain.sch.schema_engine import RiskTierPolicy
from openspec.infrastructure.reference_data.canonical_value_lov import CanonicalValueLovAdapter

_POLICY = RiskTierPolicy(tier_0_keywords=frozenset({"pressure"}), default_tier=1)

_FITTINGS_CP = LovClasspath.parse("Plumbing>Fittings>Copper Fittings")
_FAUCETS_CP = LovClasspath.parse("Plumbing>Faucets>Kitchen Faucets")

_BOTH_CATEGORY_SCOPE_RULES = (
    CategoryScopeRule(ProductCategory.FITTINGS, LovClasspath.parse("Plumbing>Fittings")),
    CategoryScopeRule(ProductCategory.FAUCETS, LovClasspath.parse("Plumbing>Faucets")),
)


class _FakeTaxonomyReference:
    def __init__(self, definitions: tuple[LovAttributeDefinition, ...]) -> None:
        self._definitions = definitions

    def attribute_definitions(self, classpath: LovClasspath) -> tuple[LovAttributeDefinition, ...]:
        return tuple(d for d in self._definitions if d.classpath == classpath)

    def all_classpaths(self) -> tuple[LovClasspath, ...]:
        return tuple({d.classpath for d in self._definitions})


def test_both_categories_resolve_via_the_same_use_case_and_scope_config() -> None:
    definitions = (
        LovAttributeDefinition(
            _FITTINGS_CP, "Connection Type", "Connection Type", True, frozenset({"SOLDER"})
        ),
        LovAttributeDefinition(
            _FAUCETS_CP, "Mount Type", "Mount Type", True, frozenset({"DECK_MOUNT"})
        ),
    )
    taxonomy = _FakeTaxonomyReference(definitions)

    fittings_result = resolve_schema_for_classpath(
        classpath=_FITTINGS_CP,
        scope_rules=_BOTH_CATEGORY_SCOPE_RULES,
        taxonomy=taxonomy,
        risk_policy=_POLICY,
    )
    faucets_result = resolve_schema_for_classpath(
        classpath=_FAUCETS_CP,
        scope_rules=_BOTH_CATEGORY_SCOPE_RULES,
        taxonomy=taxonomy,
        risk_policy=_POLICY,
    )

    assert isinstance(fittings_result, SchemaResolved)
    assert fittings_result.category == ProductCategory.FITTINGS
    assert isinstance(faucets_result, SchemaResolved)
    assert faucets_result.category == ProductCategory.FAUCETS


def test_canonical_value_adapter_serves_both_categories_from_one_instance() -> None:
    mappings = (
        CanonicalValueMapping(ProductCategory.FITTINGS, "Connection Type", "Sweat", "SOLDER"),
        CanonicalValueMapping(ProductCategory.FAUCETS, "Mount Type", "Deck", "DECK_MOUNT"),
    )
    adapter = CanonicalValueLovAdapter(mappings)
    assert (
        adapter.canonical_value(
            category=ProductCategory.FITTINGS,
            attribute_label="Connection Type",
            variant_value="Sweat",
        )
        == "SOLDER"
    )
    assert (
        adapter.canonical_value(
            category=ProductCategory.FAUCETS, attribute_label="Mount Type", variant_value="Deck"
        )
        == "DECK_MOUNT"
    )
