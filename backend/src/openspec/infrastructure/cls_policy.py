"""Loads `resources/policy/classification.yaml` into a `ClassificationPolicy`
(`CLS`, M1). File I/O, so this lives in `infrastructure/`, never
`domain/`/`application/` (INV-6) — mirrors
`infrastructure/resolution_policy.py`'s pattern exactly.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from openspec.application.usecases.classify_record import ClassificationPolicy

_RESOURCES_ROOT = Path(__file__).resolve().parents[3] / "resources"
DEFAULT_CLASSIFICATION_POLICY_PATH = _RESOURCES_ROOT / "policy" / "classification.yaml"


def load_classification_policy(
    path: Path = DEFAULT_CLASSIFICATION_POLICY_PATH,
) -> ClassificationPolicy:
    raw: dict[str, Any] = yaml.safe_load(path.read_text(encoding="utf-8"))
    return ClassificationPolicy(
        rule_min_confidence=raw["rule_min_confidence"],
        llm_validated_confidence=raw["llm_validated_confidence"],
        llm_model=raw["llm_model"],
    )
