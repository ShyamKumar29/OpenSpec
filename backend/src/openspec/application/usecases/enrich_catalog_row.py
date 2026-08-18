"""Row-level enrichment orchestration (UH4, docs/16-unilog-alignment.md UH4:
"first end-to-end enrichment on the real dataset"). Ties together the two
things this environment's real data actually supports without any missing
UniHack file: `EXT`'s verbatim source-row extraction
(`application/stages/ext.py`) and UH2's manufacturer/brand resolution
(`application/usecases/resolve_manufacturer_brand.py`) — four attributes per
row, each genuinely evidenced against `sample_input.csv`, not a fixture.

Class-specific (Fittings/Faucets LOV) attribute extraction is **not**
attempted here — that needs `SCH` (UH3) to resolve a real schema first, which
is blocked on the same missing workbook (`docs/15-backend-implementation-status.md`
§10). This use case is the honest ceiling of what UH4 can do against real
data in this environment: identity + manufacturer/brand, not the full
Fittings attribute set.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from openspec.application.ports.manufacturer_brand import ManufacturerBrandReference
from openspec.application.stages.ext import (
    extract_item_description,
    extract_mfg_part_num,
)
from openspec.application.usecases.resolve_manufacturer_brand import (
    BRAND_NAME_ATTRIBUTE,
    MANUFACTURER_NAME_ATTRIBUTE,
    ResolutionPolicy,
    resolve_manufacturer_brand,
)
from openspec.domain.model.attribute import AttributeValue
from openspec.domain.model.manufacturer import ManufacturerBrandField


class IdFactory(Protocol):
    def __call__(self, attribute_code: str) -> str: ...


@dataclass(frozen=True, slots=True)
class RowEnrichmentResult:
    row_number: int
    mfg_part_num: AttributeValue
    item_description: AttributeValue
    manufacturer_name: AttributeValue
    brand_name: AttributeValue


def enrich_catalog_row(
    *,
    row_number: int,
    mfg_part_num_raw: str,
    part_desc_raw: str,
    part_manuf_raw: str,
    dib_brand_raw: str,
    id_factory: IdFactory,
    created_at: str,
    manufacturer_brand_reference: ManufacturerBrandReference | None,
    resolution_policy: ResolutionPolicy,
    part_manuf_placeholder_tokens: frozenset[str],
    brand_placeholder_tokens: frozenset[str],
    source_dataset: str = "sample_input.csv",
) -> RowEnrichmentResult:
    mfg_part_num = extract_mfg_part_num(
        id=id_factory("MFG_PART_NUM"),
        row_number=row_number,
        mfg_part_num=mfg_part_num_raw,
        created_at=created_at,
        source_dataset=source_dataset,
    )
    item_description = extract_item_description(
        id=id_factory("ITEM_DESCRIPTION"),
        row_number=row_number,
        part_desc=part_desc_raw,
        created_at=created_at,
        source_dataset=source_dataset,
    )
    manufacturer_name = resolve_manufacturer_brand(
        id=id_factory("MANUFACTURER_NAME"),
        raw_value=part_manuf_raw,
        field=ManufacturerBrandField.MANUFACTURER,
        attribute=MANUFACTURER_NAME_ATTRIBUTE,
        created_at=created_at,
        source_dataset=source_dataset,
        row_identifier=str(row_number),
        source_column="Part_Manuf",
        reference=manufacturer_brand_reference,
        placeholder_tokens=part_manuf_placeholder_tokens,
        policy=resolution_policy,
    )
    brand_name = resolve_manufacturer_brand(
        id=id_factory("BRAND_NAME"),
        raw_value=dib_brand_raw,
        field=ManufacturerBrandField.BRAND,
        attribute=BRAND_NAME_ATTRIBUTE,
        created_at=created_at,
        source_dataset=source_dataset,
        row_identifier=str(row_number),
        source_column="DIB_Brand",
        reference=manufacturer_brand_reference,
        placeholder_tokens=brand_placeholder_tokens,
        policy=resolution_policy,
    )
    return RowEnrichmentResult(
        row_number=row_number,
        mfg_part_num=mfg_part_num,
        item_description=item_description,
        manufacturer_name=manufacturer_name,
        brand_name=brand_name,
    )
