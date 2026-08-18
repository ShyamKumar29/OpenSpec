"""Tests for `domain/nrm/connections.py` (UH4 — docs/domain/pvf-reference.md
§5, "trap #2")."""

from __future__ import annotations

from openspec.domain.nrm.connections import (
    ConnectionMatch,
    normalize_connection_type,
    resolve_ambiguous_socket,
)

_TABLE = {
    "NPT_FEMALE": ("FNPT", "FIP", "NPT-F", "THRD-F", "female threaded", "IPS female"),
    "SOLDER": ("C×C", "CxC", "SWT", "sweat", "solder cup", "copper socket"),
    "SOLVENT_WELD": ("slip", "socket (PVC context)"),
}


class TestNormalizeConnectionType:
    def test_exact_canonical_match(self) -> None:
        assert normalize_connection_type("NPT_FEMALE", _TABLE) == ConnectionMatch(
            "NPT_FEMALE", "NPT_FEMALE"
        )

    def test_synonym_match_case_insensitive(self) -> None:
        assert normalize_connection_type("fip", _TABLE) == ConnectionMatch("NPT_FEMALE", "FIP")

    def test_trade_convention_synonym_also_matches(self) -> None:
        """FIP ≈ FNPT ≈ NPT-F — §5's own "trade convention, not identity"
        example; all three resolve to the same canonical value."""
        for synonym in ("FIP", "FNPT", "NPT-F"):
            assert normalize_connection_type(synonym, _TABLE).canonical == "NPT_FEMALE"  # type: ignore[union-attr]

    def test_no_match_returns_none(self) -> None:
        assert normalize_connection_type("victaulic groove", _TABLE) is None

    def test_blank_input_returns_none(self) -> None:
        assert normalize_connection_type("  ", _TABLE) is None

    def test_whitespace_stripped(self) -> None:
        assert normalize_connection_type("  sweat  ", _TABLE) == ConnectionMatch("SOLDER", "sweat")


class TestResolveAmbiguousSocket:
    def test_copper_context_resolves_to_solder(self) -> None:
        assert resolve_ambiguous_socket("copper") == "SOLDER"

    def test_brass_context_resolves_to_solder(self) -> None:
        assert resolve_ambiguous_socket("Brass") == "SOLDER"

    def test_pvc_context_resolves_to_solvent_weld(self) -> None:
        assert resolve_ambiguous_socket("PVC") == "SOLVENT_WELD"

    def test_no_material_context_is_ambiguous(self) -> None:
        assert resolve_ambiguous_socket(None) is None

    def test_unrecognised_material_is_ambiguous(self) -> None:
        assert resolve_ambiguous_socket("stainless steel") is None
