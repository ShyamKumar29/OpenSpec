"""Loads `resources/policy/manufacturer_brand_resolution.yaml` into a
`ResolutionPolicy` (`RES`, UH2 — docs/16-unilog-alignment.md G3). File I/O, so
this lives in `infrastructure/`, never `domain/`/`application/` (INV-6) — the
thresholds themselves are declarative config (CLAUDE.md Conventions table:
"Thresholds & policies: Configuration, never literals in code"), but *reading
a file* is an effect. Mirrors `infrastructure/taxonomy_loader.py`'s pattern.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from openspec.application.usecases.resolve_manufacturer_brand import ResolutionPolicy

_RESOURCES_ROOT = Path(__file__).resolve().parents[3] / "resources"
DEFAULT_RESOLUTION_POLICY_PATH = _RESOURCES_ROOT / "policy" / "manufacturer_brand_resolution.yaml"


def load_resolution_policy(
    path: Path = DEFAULT_RESOLUTION_POLICY_PATH,
) -> ResolutionPolicy:
    raw: dict[str, Any] = yaml.safe_load(path.read_text(encoding="utf-8"))
    return ResolutionPolicy(
        exact_confidence=raw["exact_confidence"],
        normalized_exact_confidence=raw["normalized_exact_confidence"],
        alias_confidence=raw["alias_confidence"],
        fuzzy_accept_floor=raw["fuzzy_accept_floor"],
        fuzzy_ambiguity_delta=raw["fuzzy_ambiguity_delta"],
    )
