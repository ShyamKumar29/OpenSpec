"""Registers the reference datasets `docs/16-unilog-alignment.md` and
`docs/adr/ADR-0014-unilog-vocabulary-adoption.md` describe that were **not found
anywhere in this environment** during UH0 — see
`resources/reference/unihack/README.md` and `docs/15-backend-implementation-status.md`
§7 for the full writeup.

This is not a loader. It exists so that later milestones (UH2 taxonomy/manufacturer
resolution, UH4 extraction, UH5 description construction) reference an explicit,
documented gap instead of one of two worse outcomes: a loader silently returning
nothing, or a developer fabricating placeholder data to make a stub pass. Call
`require(name)` at the top of a not-yet-buildable loader to fail loudly with an
actionable message naming the exact file expected and where to put it.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import NoReturn

from openspec.infrastructure.reference_data.errors import ReferenceDataMissing


@dataclass(frozen=True, slots=True)
class MissingReferenceDataset:
    name: str
    expected_filename: str
    needed_for: str
    doc_ref: str


MISSING_DATASETS: tuple[MissingReferenceDataset, ...] = (
    MissingReferenceDataset(
        name="taxonomy_lov",
        expected_filename="Unicat_Lov_v1_0_Updated_With_Remarks.xlsx",
        needed_for="UH3 — taxonomy cutover (ADR-0014)",
        doc_ref="docs/adr/ADR-0014-unilog-vocabulary-adoption.md",
    ),
    MissingReferenceDataset(
        name="manufacturer_brand_list",
        expected_filename="UniCat_Manufacturer_and_Brand_List.xlsx",
        needed_for="UH2 — manufacturer/brand resolution (RES)",
        doc_ref="docs/adr/ADR-0014-unilog-vocabulary-adoption.md",
    ),
    MissingReferenceDataset(
        name="fittings_lov",
        expected_filename="Fittings_LOV.xlsx",
        needed_for="UH3/UH4 — Fittings taxonomy + extraction",
        doc_ref="docs/16-unilog-alignment.md",
    ),
    MissingReferenceDataset(
        name="faucets_lov",
        expected_filename="FAUCETS_LOV.xlsx",
        needed_for="UH6 — Faucets category",
        doc_ref="docs/16-unilog-alignment.md",
    ),
    MissingReferenceDataset(
        name="uom_standards",
        expected_filename="Unilog_Master_UOM_Standards_Abbreviations_and_Terms.xlsx",
        needed_for="UH4 — NRM unit normalisation",
        doc_ref="docs/16-unilog-alignment.md",
    ),
    MissingReferenceDataset(
        name="decimal_fraction",
        expected_filename="Decimal_Fraction.xlsx",
        needed_for="UH4 — NRM fraction normalisation",
        doc_ref="docs/16-unilog-alignment.md",
    ),
    MissingReferenceDataset(
        name="content_guidelines",
        expected_filename="UNILOG_INTERNAL_CONTENT_GUIDELINES.docx",
        needed_for="UH5 — description construction (DSC, ADR-0013)",
        doc_ref="docs/adr/ADR-0013-templated-description-generation.md",
    ),
)

_BY_NAME = {d.name: d for d in MISSING_DATASETS}


def list_missing_datasets() -> tuple[MissingReferenceDataset, ...]:
    return MISSING_DATASETS


def require(name: str) -> NoReturn:
    """Raises `ReferenceDataMissing` with an actionable message. `name` must be a
    key in `MISSING_DATASETS` — calling this for a dataset that isn't registered as
    missing is a programming error (raises `KeyError`), not a reference-data error.
    Typed `NoReturn` (UH2) so callers that end a function with `require(...)` don't
    need a dead trailing `raise` just to satisfy a "missing return" check — mypy
    already knows this function never returns normally."""
    dataset = _BY_NAME[name]
    raise ReferenceDataMissing(
        f"{dataset.name} is not available in this environment. Expected file "
        f"'{dataset.expected_filename}' under resources/reference/unihack/ "
        f"(needed for {dataset.needed_for}; see {dataset.doc_ref}). "
        "No substitute data exists for this dataset — do not fabricate one."
    )
