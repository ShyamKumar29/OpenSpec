"""Loads `resources/cls/abbreviations.yaml` and
`resources/policy/classification_rules.yaml` into the shapes
`domain.cls.rules_engine` consumes (`CLS`, M1). File I/O, so this lives in
`infrastructure/`, never `domain/` (INV-6) — mirrors
`infrastructure/nrm_resources.py`'s pattern exactly.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from openspec.domain.cls.rules_engine import AbbreviationTable, ClassificationRule

_RESOURCES_ROOT = Path(__file__).resolve().parents[3] / "resources"
DEFAULT_ABBREVIATIONS_PATH = _RESOURCES_ROOT / "cls" / "abbreviations.yaml"
DEFAULT_CLASSIFICATION_RULES_PATH = _RESOURCES_ROOT / "policy" / "classification_rules.yaml"


def load_abbreviation_table(path: Path = DEFAULT_ABBREVIATIONS_PATH) -> AbbreviationTable:
    raw: dict[str, Any] = yaml.safe_load(path.read_text(encoding="utf-8"))
    return {str(k).upper(): str(v).lower() for k, v in raw["abbreviations"].items()}


def load_classification_rules(
    path: Path = DEFAULT_CLASSIFICATION_RULES_PATH,
) -> tuple[ClassificationRule, ...]:
    raw: dict[str, Any] = yaml.safe_load(path.read_text(encoding="utf-8"))
    return tuple(
        ClassificationRule(
            class_code=rule["class_code"],
            required_keyword_groups=tuple(
                frozenset(str(kw).lower() for kw in group)
                for group in rule["required_keyword_groups"]
            ),
            confidence=rule["confidence"],
        )
        for rule in raw.get("rules") or ()
    )
