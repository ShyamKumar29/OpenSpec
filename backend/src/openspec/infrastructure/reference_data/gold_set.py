"""Gold-set CSV loader (`EVL`, M1 — docs/16-unilog-alignment.md G7,
docs/decisions.md OD-7). File I/O, so this lives in `infrastructure/`, never
`domain/` (INV-6).

**No real gold set exists in this environment** — see
`resources/reference/unihack/gold/README.md` for the full, re-verified
write-up. `resources/reference/unihack/gold/` ships with that README only,
no `gold_set.csv`. `load_gold_set` distinguishes a genuinely missing file
(`GOLD_SET_UNAVAILABLE`) from a present-but-malformed one
(`INVALID_GOLD_SET`) from a present-and-valid one (`GOLD_SET_AVAILABLE`) —
the M1 brief's own three-state requirement — rather than collapsing "absent"
and "empty" into one outcome.
"""

from __future__ import annotations

import csv
from pathlib import Path

from openspec.domain.evl.gold_validation import validate_gold_rows
from openspec.domain.model.gold import GoldSetAvailability, GoldSetLoadOutcome

_RESOURCES_ROOT = Path(__file__).resolve().parents[4] / "resources"
DEFAULT_GOLD_SET_PATH = _RESOURCES_ROOT / "reference" / "unihack" / "gold" / "gold_set.csv"


def load_gold_set(
    path: Path = DEFAULT_GOLD_SET_PATH, *, label_version: str = "v0"
) -> GoldSetLoadOutcome:
    if not path.exists():
        return GoldSetLoadOutcome(
            availability=GoldSetAvailability.GOLD_SET_UNAVAILABLE, gold_set=None, errors=()
        )
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = tuple({k: (v or "") for k, v in row.items()} for row in reader)
    gold_set, errors = validate_gold_rows(rows, source_name=path.name, label_version=label_version)
    if gold_set is None:
        return GoldSetLoadOutcome(
            availability=GoldSetAvailability.INVALID_GOLD_SET,
            gold_set=None,
            errors=tuple(e.render() for e in errors),
        )
    return GoldSetLoadOutcome(
        availability=GoldSetAvailability.GOLD_SET_AVAILABLE, gold_set=gold_set, errors=()
    )
