"""Idempotent seeder (docs/10-roadmap.md M0: "Idempotent seeder", verification
checklist "Seeder is idempotent (run twice, identical state)";
docs/04-data-model.md §7: "Seed data | Taxonomy, attribute definitions, rules,
and unit definitions loaded from versioned repo files by an idempotent
seeder"). Loads `resources/taxonomy/classes.yaml` into `taxonomy_class` /
`attribute_definition` (`infrastructure/db/models.py`).

`resources/rules/`, `resources/units/`, `resources/abbreviations/` don't exist
in this repository yet (`docs/15-backend-implementation-status.md` §4 — `VAL`/
`NRM`'s declarative rule/unit files are a later milestone, per
`docs/13-implementation-blueprint.md` step 12/13); seeding them is added when
those directories exist, not stubbed out here against files that aren't real.

**Idempotent by construction, not by a pre-check**: every write is a single
Postgres `INSERT ... ON CONFLICT (<natural key>) DO UPDATE` statement keyed on
the same natural key the schema already declares unique
(`taxonomy_class.code`; `attribute_definition`'s `uq_attribute_definition_code`
= `(class_id, code, schema_version)`) — running the seeder twice with
unchanged YAML produces the same rows with the same ids the second time
(`RETURNING id` is stable because `ON CONFLICT DO UPDATE` still matches and
returns the existing row), not duplicates and not an error.

**Not run against a live database in this environment**
(docs/15-backend-implementation-status.md §3). `tests/unit/test_seed.py`
proves the generated statements are well-formed idempotent upserts by
compiling them against the Postgres dialect; `tests/integration/
test_seed_idempotency.py` proves actual idempotency (run twice, assert
identical row counts and ids) against a live Postgres when one is reachable,
skipping with an explicit reason otherwise — the same pattern
`tests/integration/test_constraints.py` already established.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml
from sqlalchemy import Connection
from sqlalchemy.dialects.postgresql import insert as pg_insert

from openspec.infrastructure.db.models import AttributeDefinitionRow, TaxonomyClassRow

_RESOURCES_ROOT = Path(__file__).resolve().parents[4] / "resources"
DEFAULT_TAXONOMY_PATH = _RESOURCES_ROOT / "taxonomy" / "classes.yaml"


@dataclass(frozen=True, slots=True)
class SeedReport:
    classes_seeded: int
    attributes_seeded: int


def _load_raw_taxonomy(path: Path) -> dict[str, Any]:
    raw: dict[str, Any] = yaml.safe_load(path.read_text(encoding="utf-8"))
    return raw


def seed_taxonomy(conn: Connection, path: Path = DEFAULT_TAXONOMY_PATH) -> SeedReport:
    """One transaction, two idempotent upsert statements per class (the class
    row, then each of its attribute rows) — safe to call repeatedly, and safe
    to call inside a caller-managed transaction (no commit here; the caller
    decides the transaction boundary, per docs/05-backend.md §7's "stage
    output... commit atomically" discipline applied to seeding)."""
    raw = _load_raw_taxonomy(path)
    schema_version = str(raw["schema_version"])

    classes_seeded = 0
    attributes_seeded = 0
    for class_entry in raw["classes"]:
        class_stmt = (
            pg_insert(TaxonomyClassRow)
            .values(
                code=class_entry["code"],
                name=class_entry["name"],
                external_ref=class_entry.get("external_ref"),
                schema_version=schema_version,
            )
            .on_conflict_do_update(
                index_elements=[TaxonomyClassRow.code],
                set_={
                    "name": class_entry["name"],
                    "external_ref": class_entry.get("external_ref"),
                    "schema_version": schema_version,
                },
            )
            .returning(TaxonomyClassRow.id)
        )
        class_id = conn.execute(class_stmt).scalar_one()
        classes_seeded += 1

        for attr_entry in class_entry["attributes"]:
            attr_stmt = (
                pg_insert(AttributeDefinitionRow)
                .values(
                    class_id=class_id,
                    code=attr_entry["code"],
                    name=attr_entry["name"],
                    datatype=attr_entry["datatype"],
                    unit_dimension=attr_entry.get("unit_dimension"),
                    is_mandatory=attr_entry["is_mandatory"],
                    risk_tier=attr_entry["risk_tier"],
                    schema_version=schema_version,
                )
                .on_conflict_do_update(
                    index_elements=[
                        AttributeDefinitionRow.class_id,
                        AttributeDefinitionRow.code,
                        AttributeDefinitionRow.schema_version,
                    ],
                    set_={
                        "name": attr_entry["name"],
                        "datatype": attr_entry["datatype"],
                        "unit_dimension": attr_entry.get("unit_dimension"),
                        "is_mandatory": attr_entry["is_mandatory"],
                        "risk_tier": attr_entry["risk_tier"],
                    },
                )
            )
            conn.execute(attr_stmt)
            attributes_seeded += 1

    return SeedReport(classes_seeded=classes_seeded, attributes_seeded=attributes_seeded)
