"""End-connection synonym normalisation (`NRM`, docs/domain/pvf-reference.md
§5 — "trap #2"). Pure: takes an already-loaded synonym table (I/O for
reading `resources/nrm/connection_synonyms.yaml` lives in
`infrastructure/nrm_resources.py`) and matches free text against it.

`FIP ≈ FNPT` is a trade convention, not an identity (§5's own words) — every
match through this table is `ProvenanceKind.DERIVED`, never `EXTRACTED`, even
when the raw text is a listed synonym rather than a paraphrase; the caller
(`EXT`/`NRM` orchestration) is responsible for tagging provenance accordingly,
this module only reports *what* matched.
"""

from __future__ import annotations

from dataclasses import dataclass

ConnectionSynonymTable = dict[str, tuple[str, ...]]  # canonical -> synonyms


@dataclass(frozen=True, slots=True)
class ConnectionMatch:
    canonical: str
    matched_text: str  # the exact table entry (canonical name or synonym) that matched


def normalize_connection_type(raw: str, table: ConnectionSynonymTable) -> ConnectionMatch | None:
    """Case-insensitive match against a connection's canonical name or any of
    its listed synonyms. `None` means no entry in `table` matches — the
    caller's job to turn that into `Unknown`, never to guess."""
    normalized = raw.strip().casefold()
    if not normalized:
        return None
    for canonical, synonyms in table.items():
        if normalized == canonical.casefold():
            return ConnectionMatch(canonical=canonical, matched_text=canonical)
        for synonym in synonyms:
            if normalized == synonym.casefold():
                return ConnectionMatch(canonical=canonical, matched_text=synonym)
    return None


# `socket` is ambiguous between a copper/brass "socket" (solder) and a PVC
# "socket" (solvent weld) — §5's own worked example. Resolved by material
# context only; genuinely ambiguous when material is unknown.
_COPPER_ALLOY_MATERIAL_HINTS = frozenset({"copper", "brass", "bronze"})
_PLASTIC_MATERIAL_HINTS = frozenset({"pvc", "cpvc"})


def resolve_ambiguous_socket(material_context: str | None) -> str | None:
    """`None` for both "no material given" and "material doesn't disambiguate
    it" — genuinely ambiguous either way (§5: "if material is unknown, return
    Unknown(AMBIGUOUS_CANDIDATES)"). Only returns a canonical connection type
    when the material context clears it."""
    if not material_context:
        return None
    normalized = material_context.strip().casefold()
    if normalized in _COPPER_ALLOY_MATERIAL_HINTS:
        return "SOLDER"
    if normalized in _PLASTIC_MATERIAL_HINTS:
        return "SOLVENT_WELD"
    return None
