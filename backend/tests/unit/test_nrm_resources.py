"""Tests for `infrastructure/nrm_resources.py` (UH4). Loads the real shipped
`resources/nrm/connection_synonyms.yaml`."""

from __future__ import annotations

from openspec.domain.nrm.connections import normalize_connection_type
from openspec.infrastructure.nrm_resources import load_connection_synonym_table


def test_real_table_loads_all_eleven_canonical_connections() -> None:
    table = load_connection_synonym_table()
    assert len(table) == 11
    assert "NPT_FEMALE" in table
    assert "SOLDER" in table


def test_real_table_resolves_documented_fip_synonym() -> None:
    table = load_connection_synonym_table()
    match = normalize_connection_type("FIP", table)
    assert match is not None
    assert match.canonical == "NPT_FEMALE"


def test_real_table_resolves_documented_sweat_synonym() -> None:
    table = load_connection_synonym_table()
    match = normalize_connection_type("sweat", table)
    assert match is not None
    assert match.canonical == "SOLDER"
