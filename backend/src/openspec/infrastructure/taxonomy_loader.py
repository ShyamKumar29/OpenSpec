"""Loads `resources/taxonomy/classes.yaml` into `AttributeRef`s. File I/O, so this
lives in `infrastructure/`, never `domain/` (INV-6) — the taxonomy *data* is
declarative config (docs/05-backend.md §10), but *reading a file* is an effect.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from openspec.domain.model.attribute import AttributeRef

_RESOURCES_ROOT = Path(__file__).resolve().parents[3] / "resources"
DEFAULT_TAXONOMY_PATH = _RESOURCES_ROOT / "taxonomy" / "classes.yaml"


@dataclass(frozen=True, slots=True)
class TaxonomyClass:
    code: str
    name: str
    attributes: tuple[AttributeRef, ...]


def load_taxonomy(path: Path = DEFAULT_TAXONOMY_PATH) -> dict[str, TaxonomyClass]:
    raw: dict[str, Any] = yaml.safe_load(path.read_text(encoding="utf-8"))
    classes: dict[str, TaxonomyClass] = {}
    for entry in raw["classes"]:
        attrs = tuple(
            AttributeRef(
                code=a["code"],
                name=a["name"],
                datatype=a["datatype"],
                risk_tier=a["risk_tier"],
                is_mandatory=a["is_mandatory"],
            )
            for a in entry["attributes"]
        )
        classes[entry["code"]] = TaxonomyClass(
            code=entry["code"], name=entry["name"], attributes=attrs
        )
    return classes
