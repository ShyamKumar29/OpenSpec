"""Loads `resources/nrm/connection_synonyms.yaml` into the shape
`domain.nrm.connections.normalize_connection_type` consumes (`NRM`, UH4 —
docs/domain/pvf-reference.md §5). File I/O, so this lives in
`infrastructure/`, never `domain/` (INV-6).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from openspec.domain.nrm.connections import ConnectionSynonymTable

_RESOURCES_ROOT = Path(__file__).resolve().parents[3] / "resources"
DEFAULT_CONNECTION_SYNONYMS_PATH = _RESOURCES_ROOT / "nrm" / "connection_synonyms.yaml"


def load_connection_synonym_table(
    path: Path = DEFAULT_CONNECTION_SYNONYMS_PATH,
) -> ConnectionSynonymTable:
    raw: dict[str, Any] = yaml.safe_load(path.read_text(encoding="utf-8"))
    return {
        entry["canonical"]: tuple(str(s) for s in entry["synonyms"])
        for entry in raw["canonical_connections"]
    }
