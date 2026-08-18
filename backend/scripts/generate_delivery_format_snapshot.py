"""Regenerates `resources/reference/unihack/delivery_format.schema.json` — the frozen
snapshot `tests/unit/test_reference_data_delivery_format.py` compares the live CSV
header against, so an accidental change to `delivery_format.csv`'s columns fails a
test loudly instead of drifting silently (`docs/16-unilog-alignment.md` UH0 §9).

Run this **only** when the supplied Delivery Format file itself has legitimately
changed (a corrected/expanded file was handed over) and the new shape has been
reviewed — never to make a failing schema-drift test pass without looking at why it
failed first.

    cd backend
    .venv/Scripts/python scripts/generate_delivery_format_snapshot.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from openspec.infrastructure.reference_data.delivery_format import (  # noqa: E402
    DEFAULT_DELIVERY_FORMAT_PATH,
    load_delivery_format_schema,
)

SNAPSHOT_PATH = DEFAULT_DELIVERY_FORMAT_PATH.with_name("delivery_format.schema.json")


def main() -> None:
    schema = load_delivery_format_schema()
    snapshot = {
        "source_file": schema.source_path.name,
        "column_count": len(schema.columns),
        "columns": list(schema.column_names()),
        "attribute_slot_count": len(schema.attribute_slots()),
        "item_features_count": len(schema.item_features_columns()),
    }
    SNAPSHOT_PATH.write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {SNAPSHOT_PATH} ({snapshot['column_count']} columns)")


if __name__ == "__main__":
    main()
