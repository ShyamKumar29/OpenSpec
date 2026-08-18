"""Pure normalisation for manufacturer/brand strings (`RES`, UH2 —
docs/16-unilog-alignment.md G3). INV-6: `domain/nrm/` is free of LLM, I/O,
clock, and randomness — the architecture test
`test_domain_val_and_nrm_are_INV6_pure` (`tests/architecture/test_layering.py`)
enforces the banned-import list mechanically, and
`test_domain_imports_nothing_outside_stdlib_and_pydantic` enforces that only an
explicit, reviewed set of stdlib modules is used anywhere in `domain/` — this
file's `re` and `difflib` imports were added to that allow-list for UH2, not
silently permitted.

Every transform applied is deterministic, and the raw string is never mutated
in place — `NormalizedManufacturerBrandName.raw` is carried through unchanged
so a caller always has the original next to the normalised form (UH2 brief
§5: normalisation must be "deterministic, explainable, testable, reversible
from the stored source value").
"""

from __future__ import annotations

import difflib
import re
from dataclasses import dataclass

# Verified against the actual `Part_Manuf` column in `sample_input.csv`
# (`Freud Inc (2435)`, `Jam Industrial Supply LLC (JAMIN)`, `Kichler Lighting
# (KICLI)`, ...) — a trailing parenthetical alphanumeric code, not free text.
# Extracted, never discarded: UH2 brief §5 forbids blindly stripping meaningful
# information, and the code may be the very key the approved reference list
# indexes on once it exists.
_TRAILING_CODE_RE = re.compile(r"\s*\(([A-Za-z0-9][A-Za-z0-9\-]*)\)\s*$")

# Legal-entity / regional-entity suffixes safe to fold for *comparison*
# purposes only — every token here has been observed in the actual supplied
# `Part_Manuf` values (`Freud Inc`, `Jam Industrial Supply LLC`, `Satco Prod
# Inc`, `Makita Usa Inc`, `Festool USA`), not copied from a generic list.
# Punctuation is stripped before this check runs, so `L.L.C.` and `Inc.` are
# already single tokens (`llc`, `inc`) by the time this list is consulted.
_LEGAL_SUFFIXES = frozenset(
    {"incorporated", "inc", "corporation", "corp", "company", "co", "llc", "ltd", "limited", "usa"}
)

# ® / ™ / © are formatting noise on a brand string (UH2 brief §5's own worked
# example: `FRIGIDAIRE®` vs `FRIGIDAIRE`), never a distinguishing character.
_TRADEMARK_SYMBOLS = "®™©"


@dataclass(frozen=True, slots=True)
class NormalizedManufacturerBrandName:
    """The result of normalising one raw manufacturer/brand string. `raw` is
    carried through unchanged (source preservation, UH2 brief §5/§15) — a
    caller never has to re-derive what was originally supplied. `transforms`
    is the ordered list of named steps actually applied, for explainability
    (mirrors the `transform_step` audit trail concept, `docs/04-data-model.md`
    §3.4)."""

    raw: str
    normalized: str
    embedded_code: str | None
    transforms: tuple[str, ...]


def normalize_manufacturer_brand_name(raw: str) -> NormalizedManufacturerBrandName:
    """Deterministic and idempotent: re-normalising an already-normalised
    string is a no-op (`transforms` comes back empty, `normalized` unchanged) —
    asserted explicitly in `tests/unit/test_manufacturer_brand_normalization.py`.
    Step order is fixed and *is* the documentation of "what normalisation
    means" here; changing the order is a behaviour change, not a refactor."""
    transforms: list[str] = []
    working = raw.strip()
    if working != raw:
        transforms.append("strip_whitespace")

    code_match = _TRAILING_CODE_RE.search(working)
    embedded_code: str | None = None
    if code_match:
        embedded_code = code_match.group(1)
        working = working[: code_match.start()].rstrip()
        transforms.append("extract_trailing_code")

    stripped_symbols = "".join(ch for ch in working if ch not in _TRADEMARK_SYMBOLS)
    if stripped_symbols != working:
        working = stripped_symbols
        transforms.append("strip_trademark_symbols")

    collapsed = " ".join(working.split())
    if collapsed != working:
        working = collapsed
        transforms.append("collapse_whitespace")

    folded = working.casefold()
    if folded != working:
        working = folded
        transforms.append("casefold")

    depunctuated = re.sub(r"[.,]", "", working)
    if depunctuated != working:
        working = depunctuated
        transforms.append("strip_punctuation")

    tokens = working.split()
    stripped_any_suffix = False
    while tokens and tokens[-1] in _LEGAL_SUFFIXES:
        tokens.pop()
        stripped_any_suffix = True
    if stripped_any_suffix:
        transforms.append("strip_legal_suffix")
    working = " ".join(tokens)

    return NormalizedManufacturerBrandName(
        raw=raw,
        normalized=working,
        embedded_code=embedded_code,
        transforms=tuple(transforms),
    )


def fuzzy_similarity(a: str, b: str) -> float:
    """Deterministic similarity in `[0, 1]` — `difflib.SequenceMatcher`,
    stdlib, no randomness (INV-6). Used only for `FUZZY`-tier candidate
    generation in `application/usecases/resolve_manufacturer_brand.py`; never
    used to decide `EXACT`/`NORMALIZED_EXACT` (those are string equality, not
    a score)."""
    return difflib.SequenceMatcher(None, a, b).ratio()
