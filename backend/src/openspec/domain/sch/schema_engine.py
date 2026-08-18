"""Pure schema-resolution logic (`SCH`, UH3 — docs/16-unilog-alignment.md UH3).

Converts client LOV attribute definitions (`domain/model/taxonomy.py`) into
the existing pipeline's `AttributeRef` shape (`domain/model/attribute.py`),
so downstream stages (`EXT`/`VER`/`VAL`) don't need to know two different
attribute-definition shapes. The one thing the LOV file cannot supply is
OpenSpec's own risk-tier classification (INV-9's Tier-0 gate is *this*
project's safety policy, not the client's) — `assign_risk_tier` derives it
deterministically from the attribute's label text against a configured
keyword list, never a hardcoded per-attribute table (CLAUDE.md: "Thresholds &
policies: Configuration, never literals in code").
"""

from __future__ import annotations

from dataclasses import dataclass

from openspec.domain.model.attribute import AttributeRef
from openspec.domain.model.taxonomy import LovAttributeDefinition


@dataclass(frozen=True, slots=True)
class RiskTierPolicy:
    """`tier_0_keywords`: case-insensitive substrings of a `normalized_label`
    that make an attribute Tier 0 — INV-9's own named categories (CLAUDE.md:
    "pressure, temperature, class, compliance"). `default_tier` applies to
    every attribute whose label matches none of them."""

    tier_0_keywords: frozenset[str]
    default_tier: int

    def __post_init__(self) -> None:
        if self.default_tier not in (0, 1, 2, 3):
            raise ValueError(f"RiskTierPolicy.default_tier must be 0-3, got {self.default_tier}")


def assign_risk_tier(attribute_label: str, policy: RiskTierPolicy) -> int:
    label_lower = attribute_label.lower()
    if any(keyword in label_lower for keyword in policy.tier_0_keywords):
        return 0
    return policy.default_tier


def to_attribute_ref(definition: LovAttributeDefinition, policy: RiskTierPolicy) -> AttributeRef:
    """`is_mandatory` deliberately defaults to `False`: the LOV columns
    ADR-0014 documents (`Filtering Y/N`) describe a faceted-search flag, not
    mandatoriness, and the client's actual "required attribute" signal (if
    any) has never been inspected — reusing `filtering` for it would be a
    fabricated semantic link, not a legitimate default."""
    return AttributeRef(
        code=_slugify(definition.attribute_label),
        name=definition.attribute_label,
        datatype="enum" if definition.allowed_normalized_values else "string",
        risk_tier=assign_risk_tier(definition.normalized_label, policy),
        is_mandatory=False,
    )


def build_schema(
    definitions: tuple[LovAttributeDefinition, ...], policy: RiskTierPolicy
) -> tuple[AttributeRef, ...]:
    """Deterministic order: input order, same as `build_attribute_definitions`
    upstream. Does not deduplicate — a caller should already have passed one
    `LovAttributeDefinition` per `(classpath, attribute_label)` pair."""
    return tuple(to_attribute_ref(d, policy) for d in definitions)


def _slugify(label: str) -> str:
    """`Connection Type` -> `connection_type`. Pure text transform, no
    dependency on any external slug library (keeps this module INV-6-legal
    with zero new imports)."""
    out = []
    for ch in label.strip().lower():
        if ch.isalnum():
            out.append(ch)
        elif out and out[-1] != "_":
            out.append("_")
    return "".join(out).strip("_")
