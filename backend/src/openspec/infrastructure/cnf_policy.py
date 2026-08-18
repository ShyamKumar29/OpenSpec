"""Loads `resources/policy/cnf_routing.yaml` into a `RoutingPolicy` (`CNF`,
UH6). File I/O, so this lives in `infrastructure/`, never `domain/` (INV-6) —
mirrors `infrastructure/resolution_policy.py`'s pattern.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from openspec.domain.cnf.routing import RoutingPolicy

_RESOURCES_ROOT = Path(__file__).resolve().parents[3] / "resources"
DEFAULT_CNF_ROUTING_POLICY_PATH = _RESOURCES_ROOT / "policy" / "cnf_routing.yaml"


def load_routing_policy(path: Path = DEFAULT_CNF_ROUTING_POLICY_PATH) -> RoutingPolicy:
    raw: dict[str, Any] = yaml.safe_load(path.read_text(encoding="utf-8"))
    return RoutingPolicy(accept_threshold=raw["accept_threshold"])
