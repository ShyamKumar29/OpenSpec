"""Loads `resources/policy/attribute_risk_tiers.yaml` into a `RiskTierPolicy`
(`SCH`, UH3 — docs/16-unilog-alignment.md UH3). File I/O, so this lives in
`infrastructure/`, never `domain/` (INV-6) — mirrors
`infrastructure/resolution_policy.py`'s pattern exactly.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from openspec.domain.sch.schema_engine import RiskTierPolicy

_RESOURCES_ROOT = Path(__file__).resolve().parents[3] / "resources"
DEFAULT_ATTRIBUTE_RISK_TIERS_PATH = _RESOURCES_ROOT / "policy" / "attribute_risk_tiers.yaml"


def load_risk_tier_policy(
    path: Path = DEFAULT_ATTRIBUTE_RISK_TIERS_PATH,
) -> RiskTierPolicy:
    raw: dict[str, Any] = yaml.safe_load(path.read_text(encoding="utf-8"))
    return RiskTierPolicy(
        tier_0_keywords=frozenset(k.lower() for k in raw["tier_0_keywords"]),
        default_tier=raw["default_tier"],
    )
