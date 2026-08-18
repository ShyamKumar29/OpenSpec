"""Schema resolution use case (`SCH`, UH3 — docs/16-unilog-alignment.md UH3,
ADR-0014). Given a classpath, resolves the client-LOV-sourced attribute
schema a Fittings/Faucets record should be extracted against — replacing
`infrastructure/taxonomy_loader.py`'s hand-authored YAML as the schema source
for the two scored categories (ADR-0011's fixture is retained unchanged for
its own architecture-test role, per ADR-0014).

Orchestrates two pure layers: `domain.model.taxonomy.classify_category`
(is this classpath even in scope?) and `domain.sch.schema_engine.build_schema`
(LOV attribute definitions -> `AttributeRef`s). Never calls an LLM — schema
resolution from a controlled vocabulary is exactly the kind of "candidate
search"/lookup CLAUDE.md's "Where AI is allowed" table keeps out of AI's
hands.
"""

from __future__ import annotations

from dataclasses import dataclass

from openspec.application.ports.taxonomy import TaxonomyReference
from openspec.domain.model.attribute import AttributeRef
from openspec.domain.model.taxonomy import (
    CategoryScopeRule,
    LovClasspath,
    ProductCategory,
    classify_category,
)
from openspec.domain.sch.schema_engine import RiskTierPolicy, build_schema


@dataclass(frozen=True, slots=True)
class SchemaResolved:
    classpath: LovClasspath
    category: ProductCategory
    attributes: tuple[AttributeRef, ...]


@dataclass(frozen=True, slots=True)
class SchemaBlocked:
    """A structured "cannot resolve" outcome — distinct from `SchemaResolved`
    at the type level (mirrors `AttributeValueUnknown` vs `AttributeValueAsserted`
    in `domain/model/attribute.py`), so a caller cannot accidentally treat a
    blocked resolution as a schema with zero attributes."""

    classpath: LovClasspath
    reason: str


SchemaResolutionResult = SchemaResolved | SchemaBlocked


def resolve_schema_for_classpath(
    *,
    classpath: LovClasspath,
    scope_rules: tuple[CategoryScopeRule, ...],
    taxonomy: TaxonomyReference | None,
    risk_policy: RiskTierPolicy,
) -> SchemaResolutionResult:
    category = classify_category(classpath, scope_rules)
    if category is None:
        return SchemaBlocked(
            classpath=classpath,
            reason="CLASSPATH_OUT_OF_SCOPE — not under a configured Fittings/Faucets "
            "classpath prefix (resources/policy/category_scope.yaml)",
        )
    if taxonomy is None:
        return SchemaBlocked(
            classpath=classpath,
            reason="REFERENCE_DATA_UNAVAILABLE — no taxonomy LOV reference loaded in this "
            "environment (infrastructure/reference_data/taxonomy_lov.py)",
        )
    definitions = taxonomy.attribute_definitions(classpath)
    if not definitions:
        return SchemaBlocked(
            classpath=classpath,
            reason="NO_ATTRIBUTE_DEFINITIONS — classpath is in scope but the taxonomy "
            "reference has no rows for it",
        )
    attributes = build_schema(definitions, risk_policy)
    return SchemaResolved(classpath=classpath, category=category, attributes=attributes)
