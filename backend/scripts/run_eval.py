"""CLI entrypoint for `EVL` (`make eval`, docs/10-roadmap.md M1: "the
evaluation harness against the gold set → report + charts").

    cd backend
    .venv/Scripts/python scripts/run_eval.py

Wires the real `EVL` harness (`application/usecases/run_evaluation.py`)
against:

- **Gold set**: `infrastructure/reference_data/gold_set.py`'s
  `load_gold_set()`. No real gold set exists in this environment (see
  `resources/reference/unihack/gold/README.md`) — this run will honestly
  report `GOLD_SET_UNAVAILABLE`, never a fabricated accuracy number.
- **Predictions**: the real, existing `enrich_catalog_row` use case (UH4)
  run against all 1,000 real `sample_input.csv` rows — genuine pipeline
  output, not a fixture, for the four attributes that use case actually
  produces. Wiring this script to real predictions is what makes the
  `GOLD_SET_UNAVAILABLE` outcome meaningful rather than vacuous: the harness
  has real predictions ready to score the moment a real gold set arrives.

Writes both a Markdown and a JSON report to `evaluation/reports/`.
"""

from __future__ import annotations

import sys
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from openspec.application.usecases.enrich_catalog_row import enrich_catalog_row  # noqa: E402
from openspec.application.usecases.eval_report import (  # noqa: E402
    render_eval_json,
    render_eval_markdown,
)
from openspec.application.usecases.resolve_manufacturer_brand import ResolutionPolicy  # noqa: E402
from openspec.application.usecases.run_evaluation import run_evaluation  # noqa: E402
from openspec.domain.evl.adapters import prediction_from_attribute_value  # noqa: E402
from openspec.domain.model.gold import Prediction  # noqa: E402
from openspec.infrastructure.reference_data.gold_set import load_gold_set  # noqa: E402
from openspec.infrastructure.reference_data.sample_input import (  # noqa: E402
    KNOWN_BRAND_PLACEHOLDERS,
    KNOWN_PART_MANUF_PLACEHOLDER,
    load_sample_input_rows,
)
from openspec.infrastructure.resolution_policy import load_resolution_policy  # noqa: E402

_REPORTS_DIR = Path(__file__).resolve().parents[1] / "evaluation" / "reports"


def _collect_predictions(
    resolution_policy: ResolutionPolicy, run_started_at: str
) -> tuple[Prediction, ...]:
    rows = load_sample_input_rows()
    predictions: list[Prediction] = []
    for row in rows:
        result = enrich_catalog_row(
            row_number=row.row_number,
            mfg_part_num_raw=row.mfg_part_num,
            part_desc_raw=row.part_desc,
            part_manuf_raw=row.part_manuf,
            dib_brand_raw=row.dib_brand,
            id_factory=lambda code, row_number=row.row_number: f"{row_number}:{code}",
            created_at=run_started_at,
            # UniCat_Manufacturer_and_Brand_List.xlsx is not present in this
            # environment (docs/15-backend-implementation-status.md §9) — RES
            # honestly returns Unknown(REFERENCE_DATA_UNAVAILABLE) for every
            # row, same as every other session that has run this pipeline.
            manufacturer_brand_reference=None,
            resolution_policy=resolution_policy,
            part_manuf_placeholder_tokens=frozenset({KNOWN_PART_MANUF_PLACEHOLDER}),
            brand_placeholder_tokens=KNOWN_BRAND_PLACEHOLDERS,
        )
        record_id = str(row.row_number)
        predictions.append(
            prediction_from_attribute_value(
                record_id=record_id, field="MFG_PART_NUM", value=result.mfg_part_num
            )
        )
        predictions.append(
            prediction_from_attribute_value(
                record_id=record_id, field="ITEM_DESCRIPTION", value=result.item_description
            )
        )
        predictions.append(
            prediction_from_attribute_value(
                record_id=record_id, field="MANUFACTURER_NAME", value=result.manufacturer_name
            )
        )
        predictions.append(
            prediction_from_attribute_value(
                record_id=record_id, field="BRAND_NAME", value=result.brand_name
            )
        )
    return tuple(predictions)


def main() -> None:
    run_started_at = datetime.now(UTC).isoformat()
    run_id = f"eval_{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}"

    resolution_policy = load_resolution_policy()
    predictions = _collect_predictions(resolution_policy, run_started_at)

    result = run_evaluation(
        run_id=run_id,
        dataset="sample_input.csv",
        timestamp=run_started_at,
        load_gold=load_gold_set,
        predictions=predictions,
    )

    _REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    md_path = _REPORTS_DIR / f"{run_id}.md"
    json_path = _REPORTS_DIR / f"{run_id}.json"
    md_path.write_text(render_eval_markdown(result), encoding="utf-8")
    json_path.write_text(render_eval_json(result), encoding="utf-8")

    print(f"Gold-set availability: {result.availability.value}")
    print(f"Predictions produced: {len(predictions)}")
    print(f"Report written: {md_path}")
    print(f"Report written: {json_path}")

    if result.availability.value != "GOLD_SET_AVAILABLE":
        print(
            "\nNo real gold set exists in this environment — see "
            "resources/reference/unihack/gold/README.md. This is expected, "
            "not an error; the harness itself is fully exercised against "
            "real predictions and will score them the moment a real gold "
            "set is supplied."
        )


if __name__ == "__main__":
    main()
