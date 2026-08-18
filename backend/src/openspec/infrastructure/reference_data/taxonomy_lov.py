"""`TaxonomyLovAdapter` — the infrastructure implementation of
`application.ports.taxonomy.TaxonomyReference` (`SCH`, UH3 —
docs/16-unilog-alignment.md UH3, ADR-0014).

**The workbook this adapter would index, `Unicat_Lov_v1_0_Updated_With_Remarks.xlsx`
(~161k rows), is not present in this environment.** Re-verified at the start
of this UH3 session (machine-wide search of the user's home directory and
every previously-checked location) — same conclusion as UH0/UH1/UH2's three
prior passes (`docs/15-backend-implementation-status.md` §7, §9). No
substitute or fabricated workbook was created.

**What *is* built and tested here:** the adapter's indexing/lookup logic
(`TaxonomyLovAdapter`), which takes an already-parsed `tuple[LovRow, ...]` and
needs no knowledge of the workbook's byte format — only the logical shape
`domain.model.taxonomy.LovRow` already defines. `tests/unit/
test_taxonomy_lov_adapter.py` exercises it against a small, explicitly-labelled
test fixture — never real Unicat data, and never presented as if it were.
When the real workbook arrives, only `load_taxonomy_lov_reference` below needs
writing (a real `.xlsx` parser producing `LovRow`s); this class does not
change (same "architecture now, data later" shape as UH2's manufacturer/brand
adapter).
"""

from __future__ import annotations

import collections
from pathlib import Path

from openspec.domain.model.taxonomy import (
    LovAttributeDefinition,
    LovClasspath,
    LovRow,
    build_attribute_definitions,
)
from openspec.infrastructure.reference_data import missing_datasets

_RESOURCES_ROOT = Path(__file__).resolve().parents[4] / "resources"
# Filename this loader will look for once the workbook is supplied — matching
# the naming convention `resources/reference/unihack/README.md` documents for
# every other file in this directory (lower_snake_case, original extension).
DEFAULT_TAXONOMY_LOV_PATH = _RESOURCES_ROOT / "reference" / "unihack" / "unicat_lov.xlsx"


class TaxonomyLovAdapter:
    """Indexed, in-memory implementation of `TaxonomyReference`
    (`application/ports/taxonomy.py`). Built once from a flat `LovRow` tuple;
    `attribute_definitions` is an O(1) dict lookup per classpath."""

    def __init__(self, rows: tuple[LovRow, ...]) -> None:
        self._by_classpath: dict[LovClasspath, list[LovRow]] = collections.defaultdict(list)
        for row in rows:
            self._by_classpath[row.classpath].append(row)
        self._definitions: dict[LovClasspath, tuple[LovAttributeDefinition, ...]] = {
            classpath: build_attribute_definitions(tuple(rows_for_classpath))
            for classpath, rows_for_classpath in self._by_classpath.items()
        }

    def attribute_definitions(self, classpath: LovClasspath) -> tuple[LovAttributeDefinition, ...]:
        return self._definitions.get(classpath, ())

    def all_classpaths(self) -> tuple[LovClasspath, ...]:
        return tuple(self._by_classpath.keys())


def load_taxonomy_lov_reference(path: Path = DEFAULT_TAXONOMY_LOV_PATH) -> TaxonomyLovAdapter:
    """Would parse `Unicat_Lov_v1_0_Updated_With_Remarks.xlsx` into `LovRow`s
    and hand them to `TaxonomyLovAdapter` — once that file exists anywhere in
    this environment. It does not today (module docstring above).

    Deliberately **not** implemented as a best-guess `openpyxl` parser against
    an assumed sheet/column layout — this project has never seen the file's
    real header row, and CLAUDE.md forbids fabricating or guessing at
    supplied reference data. Raises loudly instead via `missing_datasets.py`'s
    established pattern. `path` is accepted (not hardcoded) so the only
    change needed when the file arrives is deleting this docstring and this
    one `require()` call."""
    missing_datasets.require("taxonomy_lov")
