"""Taxonomy/LOV value objects (`SCH`, UH3 — docs/16-unilog-alignment.md UH3,
ADR-0014). Pure domain shapes for the client's controlled vocabulary
(`Unicat_Lov_v1_0_Updated_With_Remarks.xlsx`, `Fittings_LOV.xlsx`,
`FAUCETS_LOV.xlsx` — none present in this environment, see
`infrastructure/reference_data/missing_datasets.py`).

This module does not know how to *read* any of those files — that is
infrastructure's job (INV-6: no I/O here). It only defines the shape a row of
each sheet takes once parsed, and the pure aggregation/lookup logic over
already-parsed rows. `ADR-0011`'s hand-authored `TaxonomyClass`
(`infrastructure/taxonomy_loader.py`) is untouched and kept as the
architecture-test fixture ADR-0014 already scopes it to — this module is the
*replacement* schema source for the two client-scored categories, not a
rewrite of the old one.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from openspec.domain.errors import InvariantViolation

# ---- Classpath ---------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class LovClasspath:
    """A `>`-delimited hierarchical category path, e.g. `Plumbing &
    HVAC>Fittings>Copper Fittings` — the shape ADR-0014 describes for the
    Unicat LOV's `Classpath` column. Parsed into segments so prefix/ancestor
    checks (`is_under`) are structural, not substring matching (which would
    false-positive on e.g. `Fittings` vs `Faucet Fittings`)."""

    segments: tuple[str, ...]

    def __post_init__(self) -> None:
        if not self.segments:
            raise InvariantViolation("LovClasspath must have at least one segment")
        if any(not s.strip() for s in self.segments):
            raise InvariantViolation(f"LovClasspath has a blank segment: {self.segments!r}")

    @staticmethod
    def parse(raw: str) -> LovClasspath:
        return LovClasspath(tuple(part.strip() for part in raw.split(">")))

    def render(self) -> str:
        return ">".join(self.segments)

    def is_under(self, prefix: LovClasspath) -> bool:
        """True if `prefix` is this classpath's ancestor or itself — segment-
        wise, not a raw string prefix."""
        if len(prefix.segments) > len(self.segments):
            return False
        return self.segments[: len(prefix.segments)] == prefix.segments


# ---- Category scope (UH3 §4: Fittings first, Faucets second) -----------------


class ProductCategory(StrEnum):
    """The two categories `docs/16-unilog-alignment.md` §4 re-scopes the demo
    to. Deliberately closed — a third category is a deliberate widening of
    this enum, not an implicit fallthrough."""

    FITTINGS = "FITTINGS"
    FAUCETS = "FAUCETS"


@dataclass(frozen=True, slots=True)
class CategoryScopeRule:
    """Maps one `LovClasspath` prefix to the category it identifies. A list of
    these *is* the category boundary — declarative, loaded from config
    (`resources/policy/category_scope.yaml`), never a hardcoded string
    comparison buried in a stage. Real prefixes are supplied by the Unicat LOV
    file's actual `Classpath` values; until that file exists, this list is
    necessarily empty (see `infrastructure/reference_data/taxonomy_lov.py`) —
    an honest empty configuration, not a fabricated guess at what the real
    Classpath strings look like."""

    category: ProductCategory
    classpath_prefix: LovClasspath


def classify_category(
    classpath: LovClasspath, rules: tuple[CategoryScopeRule, ...]
) -> ProductCategory | None:
    """First matching rule wins; `None` means "not in the Fittings/Faucets
    scope this track cares about" — a legitimate, expected outcome for most
    of a real client catalog, not an error."""
    for rule in rules:
        if classpath.is_under(rule.classpath_prefix):
            return rule.category
    return None


# ---- LOV rows (Unicat_Lov_v1_0_Updated_With_Remarks.xlsx's columns) ----------


@dataclass(frozen=True, slots=True)
class LovRow:
    """One row of the ~161k-row Unicat LOV sheet (ADR-0014's column list:
    Classpath, Leaf Node, Filtering Y/N, Attribute Label, Attribute Values,
    Normalized Label, Normalized Values, Guidelines, Remarks). `Filtering Y/N`
    is a faceted-search flag per the source column name — it is **not**
    reused here as an is-mandatory signal; that would be guessing at a
    semantic the real file has never been inspected to confirm."""

    classpath: LovClasspath
    leaf_node: str
    filtering: bool
    attribute_label: str
    attribute_value_raw: str
    normalized_label: str
    normalized_value: str
    guidelines: str
    remarks: str

    def __post_init__(self) -> None:
        if not self.attribute_label.strip():
            raise InvariantViolation("LovRow.attribute_label must be non-blank")
        if not self.normalized_label.strip():
            raise InvariantViolation("LovRow.normalized_label must be non-blank")


@dataclass(frozen=True, slots=True)
class LovAttributeDefinition:
    """The aggregation of every `LovRow` sharing one `(classpath,
    attribute_label)` pair — the client's equivalent of
    `docs/04-data-model.md` §3.2's `attribute_definition`. `allowed_normalized_values`
    is empty for a free-text attribute (no enumerated LOV values under this
    label) — that is a legitimate shape, not a loader bug."""

    classpath: LovClasspath
    attribute_label: str
    normalized_label: str
    filtering: bool
    allowed_normalized_values: frozenset[str]


def build_attribute_definitions(
    rows: tuple[LovRow, ...],
) -> tuple[LovAttributeDefinition, ...]:
    """Pure grouping over already-parsed rows — no I/O, so it belongs here and
    not in `infrastructure/`. Deterministic output order: first-seen
    `(classpath, attribute_label)` pair, in input order."""
    order: list[tuple[LovClasspath, str]] = []
    grouped: dict[tuple[LovClasspath, str], list[LovRow]] = {}
    for row in rows:
        key = (row.classpath, row.attribute_label)
        if key not in grouped:
            grouped[key] = []
            order.append(key)
        grouped[key].append(row)

    definitions: list[LovAttributeDefinition] = []
    for key in order:
        group = grouped[key]
        first = group[0]
        allowed = frozenset(r.normalized_value for r in group if r.normalized_value.strip())
        definitions.append(
            LovAttributeDefinition(
                classpath=first.classpath,
                attribute_label=first.attribute_label,
                normalized_label=first.normalized_label,
                filtering=first.filtering,
                allowed_normalized_values=allowed,
            )
        )
    return tuple(definitions)


# ---- Canonical value mapping (Fittings_LOV / FAUCETS_LOV many-to-one) --------


@dataclass(frozen=True, slots=True)
class CanonicalValueMapping:
    """One row of a category-specific many-to-one canonicalisation table —
    ADR-0014's worked example: "1,472 manufacturer connection-type variants →
    515 canonical values" from `Fittings_LOV.xlsx`. `variant_value` is
    whatever free-text form a supplier used; `canonical_value` is the one
    approved form it maps to."""

    category: ProductCategory
    attribute_label: str
    variant_value: str
    canonical_value: str

    def __post_init__(self) -> None:
        if not self.variant_value.strip():
            raise InvariantViolation("CanonicalValueMapping.variant_value must be non-blank")
        if not self.canonical_value.strip():
            raise InvariantViolation("CanonicalValueMapping.canonical_value must be non-blank")


def index_canonical_values(
    mappings: tuple[CanonicalValueMapping, ...],
) -> dict[tuple[ProductCategory, str, str], str]:
    """Pure index build: `(category, attribute_label, variant_value) ->
    canonical_value`. A caller doing many lookups builds this once rather than
    scanning `mappings` per call — the same shape
    `infrastructure/reference_data/manufacturer_brand_list.py`'s adapter uses,
    just without any I/O here."""
    index: dict[tuple[ProductCategory, str, str], str] = {}
    for m in mappings:
        index[(m.category, m.attribute_label, m.variant_value)] = m.canonical_value
    return index
