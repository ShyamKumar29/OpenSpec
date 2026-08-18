"""Loads `resources/policy/verification.yaml` into a `VerificationPolicy` (`VER`,
M3). File I/O, so this lives in `infrastructure/`, never `domain/`/`application/`
(INV-6) — mirrors `infrastructure/cnf_policy.py`'s pattern.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from openspec.application.usecases.verify_extraction import VerificationPolicy

_RESOURCES_ROOT = Path(__file__).resolve().parents[3] / "resources"
DEFAULT_VERIFICATION_POLICY_PATH = _RESOURCES_ROOT / "policy" / "verification.yaml"


def load_verification_policy(path: Path = DEFAULT_VERIFICATION_POLICY_PATH) -> VerificationPolicy:
    raw: dict[str, Any] = yaml.safe_load(path.read_text(encoding="utf-8"))
    return VerificationPolicy(
        llm_entailed_confidence=raw["llm_entailed_confidence"],
        llm_partial_confidence=raw["llm_partial_confidence"],
        deterministic_only_confidence=raw["deterministic_only_confidence"],
    )
