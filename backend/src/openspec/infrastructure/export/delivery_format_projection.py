"""Projects internal pipeline output onto the real 252-column Delivery
Format shape (UH7 — docs/16-unilog-alignment.md UH7, ADR-0010). Lives in
`infrastructure/` (not `application/`) because it operates directly on
`infrastructure.reference_data.delivery_format.DeliveryFormatSchema` — the
schema type derived from the live CSV header, per UH0's "never hand-type the
252 columns" decision.

**Every column always gets a value: either a genuine `ACCEPTED` attribute's
`value_display`, or the empty string.** Never a fabricated value to fill a
gap, never `"N/A"` or `"Unknown"` as literal text (INV-4: "never null, never
'N/A'" — the empty CSV cell *is* this format's only way to represent
"nothing asserted here yet"; the real reason code stays in the domain layer's
own `AttributeValueUnknown.unknown_reason`, which a flat 252-column row has
no column to carry).

`ATTRIBUTE_TO_COLUMN` is deliberately small: only the four attributes UH4
actually produces real, evidenced values for
(`application/usecases/enrich_catalog_row.py`). Every other column — the
`ATTRIBUTE_LABEL/VALUE/UOM` triples, `ITEM_FEATURES_n`, the five description
fields, pricing, images, documents — has no source in this environment and
is projected empty, honestly, not guessed.
"""

from __future__ import annotations

from openspec.domain.model.attribute import AttributeValue, AttributeValueStatus, is_unknown
from openspec.infrastructure.reference_data.delivery_format import DeliveryFormatSchema

# Maps this project's internal attribute code to the Delivery Format column
# it projects onto. Verified against the real CSV header
# (`resources/reference/unihack/delivery_format.csv`, columns 11/12/17/18) —
# never assumed.
ATTRIBUTE_TO_COLUMN: dict[str, str] = {
    "MFG_PART_NUM": "Mfg_Part_Num",
    "ITEM_DESCRIPTION": "Part_Desc",
    "MANUFACTURER_NAME": "MANUFACTURER_NAME",
    "BRAND_NAME": "BRAND_NAME",
}

_COLUMN_TO_ATTRIBUTE: dict[str, str] = {v: k for k, v in ATTRIBUTE_TO_COLUMN.items()}


def project_record_to_delivery_format_row(
    schema: DeliveryFormatSchema,
    attribute_values: dict[str, AttributeValue],
    *,
    unknown_placeholder: str = "",
) -> dict[str, str]:
    row: dict[str, str] = {}
    for column in schema.columns:
        attribute_code = _COLUMN_TO_ATTRIBUTE.get(column.name)
        value = attribute_values.get(attribute_code) if attribute_code else None
        if (
            value is not None
            and not is_unknown(value)
            and value.status is AttributeValueStatus.ACCEPTED
        ):
            row[column.name] = value.value_display  # type: ignore[union-attr]
        else:
            row[column.name] = unknown_placeholder
    return row
