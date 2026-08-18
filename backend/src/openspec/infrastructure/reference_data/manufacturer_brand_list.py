"""`ManufacturerBrandListAdapter` — the infrastructure implementation of
`application.ports.manufacturer_brand.ManufacturerBrandReference` (`RES`, UH2 —
docs/16-unilog-alignment.md G3).

**The approved workbook this adapter would index,
`UniCat_Manufacturer_and_Brand_List.xlsx`, is not present in this
environment.** Re-verified at the start of this UH2 session: searched the
user's Desktop, Downloads, Documents, the rest of the home directory, and a
second mapped drive (`Z:\\`, including its `Docs`/`Projects` subfolders) for
the file itself and every other name in `missing_datasets.MISSING_DATASETS`.
Found nothing new — same conclusion as `docs/15-backend-implementation-status.md`
§7's two prior UH0 passes. No substitute or fabricated data was created for it,
per this session's explicit instruction.

**What *is* built and tested here:** the adapter's indexing and lookup logic
(`ManufacturerBrandListAdapter`), which takes an already-parsed
`tuple[ManufacturerBrandCandidate, ...]` and needs no knowledge of the
workbook's byte format — only the logical shape
`domain.model.manufacturer.ManufacturerBrandCandidate` already defines.
`tests/unit/test_manufacturer_brand_list_adapter.py` exercises it against a
small, explicitly-labelled test fixture — never real UniCat data, and never
presented as if it were. When the real workbook arrives, only
`load_manufacturer_brand_reference` below needs writing; this class does not
change (UH2 brief §1: "build the resolution architecture so the official
dataset can be plugged in later without redesign").
"""

from __future__ import annotations

import collections
from pathlib import Path

from openspec.domain.model.manufacturer import ManufacturerBrandCandidate, ManufacturerBrandField
from openspec.domain.nrm.manufacturer_brand import normalize_manufacturer_brand_name
from openspec.infrastructure.reference_data import missing_datasets

_RESOURCES_ROOT = Path(__file__).resolve().parents[4] / "resources"
# Filename this loader will look for once the workbook is supplied — matching
# the naming convention `resources/reference/unihack/README.md` documents for
# every other file in this directory (lower_snake_case, original extension).
DEFAULT_MANUFACTURER_BRAND_LIST_PATH = (
    _RESOURCES_ROOT / "reference" / "unihack" / "manufacturer_brand_list.xlsx"
)

_CandidateIndex = dict[tuple[ManufacturerBrandField, str], list[ManufacturerBrandCandidate]]


class ManufacturerBrandListAdapter:
    """Indexed, in-memory implementation of `ManufacturerBrandReference`
    (`application/ports/manufacturer_brand.py`). Built once from a flat
    candidate tuple; `exact_matches`/`normalized_exact_matches`/
    `normalized_alias_matches` are O(1) dict lookups — UH2 brief §7's "avoid
    scanning the entire workbook for every product". `all_candidates` is the
    one method that returns everything for a field; the resolver only calls
    it at the FUZZY tier, after the three indexed tiers have all missed."""

    def __init__(self, candidates: tuple[ManufacturerBrandCandidate, ...]) -> None:
        self._by_field: dict[ManufacturerBrandField, list[ManufacturerBrandCandidate]] = (
            collections.defaultdict(list)
        )
        self._exact: _CandidateIndex = collections.defaultdict(list)
        self._normalized: _CandidateIndex = collections.defaultdict(list)
        self._normalized_alias: _CandidateIndex = collections.defaultdict(list)

        for candidate in candidates:
            self._by_field[candidate.field].append(candidate)
            self._exact[(candidate.field, candidate.canonical_value)].append(candidate)
            normalized_value = normalize_manufacturer_brand_name(
                candidate.canonical_value
            ).normalized
            self._normalized[(candidate.field, normalized_value)].append(candidate)
            for alias in candidate.aliases:
                normalized_alias = normalize_manufacturer_brand_name(alias).normalized
                self._normalized_alias[(candidate.field, normalized_alias)].append(candidate)

    def exact_matches(
        self, raw: str, *, field: ManufacturerBrandField
    ) -> tuple[ManufacturerBrandCandidate, ...]:
        return tuple(self._exact.get((field, raw), ()))

    def normalized_exact_matches(
        self, normalized: str, *, field: ManufacturerBrandField
    ) -> tuple[ManufacturerBrandCandidate, ...]:
        return tuple(self._normalized.get((field, normalized), ()))

    def normalized_alias_matches(
        self, normalized: str, *, field: ManufacturerBrandField
    ) -> tuple[ManufacturerBrandCandidate, ...]:
        return tuple(self._normalized_alias.get((field, normalized), ()))

    def all_candidates(
        self, *, field: ManufacturerBrandField
    ) -> tuple[ManufacturerBrandCandidate, ...]:
        return tuple(self._by_field.get(field, ()))


def load_manufacturer_brand_reference(
    path: Path = DEFAULT_MANUFACTURER_BRAND_LIST_PATH,
) -> ManufacturerBrandListAdapter:
    """Would parse `UniCat_Manufacturer_and_Brand_List.xlsx` into
    `ManufacturerBrandCandidate`s and hand them to `ManufacturerBrandListAdapter`
    — once that file exists anywhere in this environment. It does not today
    (module docstring above).

    Deliberately **not** implemented as a best-guess `openpyxl` parser against
    an assumed sheet/column layout: this project has never seen the file's
    real header, and both CLAUDE.md and this session's brief forbid
    fabricating or guessing at supplied reference data — writing untested
    parsing code against an invented schema would be exactly that risk
    wearing a different hat. Raises loudly instead, via
    `missing_datasets.py`'s established pattern, so a caller fails fast with
    an actionable message rather than silently getting an empty or
    wrong reference set. `path` is accepted (rather than hardcoded) so the
    only change needed when the file arrives is deleting this docstring and
    this one `require()` call — the signature callers already depend on does
    not change."""
    missing_datasets.require("manufacturer_brand_list")
