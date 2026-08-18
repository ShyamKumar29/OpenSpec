"""Loads per-class description formulas from
`resources/description-formulas/<class_code>.yaml` (`DSC`, UH5 — ADR-0013).

**`UNILOG_INTERNAL_CONTENT_GUIDELINES.docx`, the document that would supply
the real construction formulas, is not present in this environment**
(`infrastructure/reference_data/missing_datasets.py`). `resources/description-formulas/`
therefore ships with no class formula files today — see that directory's own
`README.md`. A missing file is treated as "no formulas configured for this
class yet" (an empty dict), not an error: unlike the client-supplied
reference workbooks (`missing_datasets.require(...)`'s loud-failure pattern),
this directory holds *this project's own* config, which legitimately starts
empty and grows one reviewed YAML file at a time — inventing formulas to fill
it now, without a documented source, is exactly what this session's brief
forbids.

`DescriptionFormulaAdapter` (implementing `application.ports.description_formulas.
DescriptionFormulaReference`) is fully implemented and unit-tested against a
small fixture directory (`tests/unit/test_description_formula_loader.py`) —
never presented as a real client formula.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from openspec.domain.model.description import (
    AttributeSlot,
    Casing,
    DescriptionFormula,
    FormulaSlot,
    LiteralSlot,
)

_RESOURCES_ROOT = Path(__file__).resolve().parents[4] / "resources"
DEFAULT_DESCRIPTION_FORMULAS_DIR = _RESOURCES_ROOT / "description-formulas"


def _parse_slot(raw: dict[str, Any]) -> FormulaSlot:
    kind = raw["kind"]
    if kind == "attribute":
        return AttributeSlot(
            attribute_code=raw["attribute_code"], casing=Casing(raw.get("casing", "AS_IS"))
        )
    if kind == "literal":
        return LiteralSlot(text=raw["text"])
    raise ValueError(f"unknown description formula slot kind: {kind!r}")


def load_class_formulas(
    class_code: str, base_dir: Path = DEFAULT_DESCRIPTION_FORMULAS_DIR
) -> dict[str, DescriptionFormula]:
    path = base_dir / f"{class_code}.yaml"
    if not path.exists():
        return {}
    raw: dict[str, Any] = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    default_version = str(raw.get("formula_version", "1"))
    formulas: dict[str, DescriptionFormula] = {}
    for field_code, spec in (raw.get("fields") or {}).items():
        formulas[field_code] = DescriptionFormula(
            field_code=field_code,
            class_code=class_code,
            formula_version=str(spec.get("formula_version", default_version)),
            slots=tuple(_parse_slot(s) for s in spec["slots"]),
            separator=spec.get("separator", ", "),
            casing=Casing(spec.get("casing", "AS_IS")),
        )
    return formulas


class DescriptionFormulaAdapter:
    """Indexed, in-memory implementation of `DescriptionFormulaReference`.
    Loads every class file under `base_dir` once at construction."""

    def __init__(
        self, class_codes: tuple[str, ...], base_dir: Path = DEFAULT_DESCRIPTION_FORMULAS_DIR
    ) -> None:
        self._formulas: dict[tuple[str, str], DescriptionFormula] = {}
        for class_code in class_codes:
            for field_code, formula in load_class_formulas(class_code, base_dir).items():
                self._formulas[(field_code, class_code)] = formula

    def formula_for(self, *, field_code: str, class_code: str) -> DescriptionFormula | None:
        return self._formulas.get((field_code, class_code))
