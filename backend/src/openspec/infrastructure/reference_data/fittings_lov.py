"""Loader seam for `Fittings_LOV.xlsx` (UH3/UH4 — docs/16-unilog-alignment.md
§4, ADR-0014: "1,472 manufacturer connection-type variants -> 515 canonical
values; 464 Material Construction -> 113 canonical").

**Not present in this environment** — re-verified at the start of this UH3
session, same conclusion as every prior pass
(`resources/reference/unihack/README.md`). `CanonicalValueLovAdapter`
(`infrastructure/reference_data/canonical_value_lov.py`) is the fully
implemented, fully tested indexing/lookup logic; only the real `.xlsx` parse
is missing. `tests/unit/test_fittings_lov_adapter.py` exercises the adapter
against a small, explicitly-labelled fixture shaped like ADR-0014's own
worked example (connection type + material), never real Fittings_LOV data.
"""

from __future__ import annotations

from pathlib import Path

from openspec.infrastructure.reference_data import missing_datasets
from openspec.infrastructure.reference_data.canonical_value_lov import CanonicalValueLovAdapter

_RESOURCES_ROOT = Path(__file__).resolve().parents[4] / "resources"
DEFAULT_FITTINGS_LOV_PATH = _RESOURCES_ROOT / "reference" / "unihack" / "fittings_lov.xlsx"


def load_fittings_lov_reference(path: Path = DEFAULT_FITTINGS_LOV_PATH) -> CanonicalValueLovAdapter:
    """Would parse `Fittings_LOV.xlsx`'s four sheets into
    `CanonicalValueMapping`s — once that file exists anywhere in this
    environment. Deliberately not a best-guess parser against an unseen
    layout — same reasoning as `manufacturer_brand_list.py` and
    `taxonomy_lov.py`. `path` is accepted, not hardcoded, so only this
    `require()` call needs deleting once the file arrives."""
    missing_datasets.require("fittings_lov")
