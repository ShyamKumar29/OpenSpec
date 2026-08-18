"""Loads `resources/policy/category_scope.yaml` into a tuple of
`CategoryScopeRule` (UH3 §4 — docs/16-unilog-alignment.md). File I/O, so this
lives in `infrastructure/`, never `domain/` (INV-6).

The shipped config is deliberately empty (see that file's own header comment)
— `Unicat_Lov_v1_0_Updated_With_Remarks.xlsx` is not present in this
environment, so there is no real `Classpath` prefix to configure yet. This
loader is real and tested against a *non-empty* fixture file
(`tests/unit/test_category_scope_policy.py`) so the parsing path itself is
proven, independent of whether the shipped config happens to be empty today.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from openspec.domain.model.taxonomy import CategoryScopeRule, LovClasspath, ProductCategory

_RESOURCES_ROOT = Path(__file__).resolve().parents[3] / "resources"
DEFAULT_CATEGORY_SCOPE_PATH = _RESOURCES_ROOT / "policy" / "category_scope.yaml"


def load_category_scope_rules(
    path: Path = DEFAULT_CATEGORY_SCOPE_PATH,
) -> tuple[CategoryScopeRule, ...]:
    raw: dict[str, Any] = yaml.safe_load(path.read_text(encoding="utf-8"))
    return tuple(
        CategoryScopeRule(
            category=ProductCategory(rule["category"]),
            classpath_prefix=LovClasspath.parse(rule["classpath_prefix"]),
        )
        for rule in raw.get("rules") or ()
    )
