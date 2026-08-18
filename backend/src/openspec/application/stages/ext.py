"""`EXT` — attribute-candidate extraction (UH4, docs/16-unilog-alignment.md
UH4). Scoped to what this environment's real data actually supports:
verbatim source-row fields from `sample_input.csv`
(`infrastructure/reference_data/sample_input.py`'s `SupplierInputRow`) cited
as `SourceRowSpan` evidence.

**No manufacturer PDFs exist in this dataset.** Any attribute that would need
document-sourced evidence gets `Unknown(NO_DOCUMENT_FOUND)` by construction —
this module never fabricates a `DocumentSpan`. **No LOV-validated attribute
extraction from free text (`Part_Desc`) is attempted here either**: without
`Fittings_LOV.xlsx`/`FAUCETS_LOV.xlsx` there is no approved vocabulary to
check a parsed value against (UH3, `docs/15-backend-implementation-status.md`
§10), and asserting a canonical value with nothing to verify it against would
be exactly the "confident wrong answer" CLAUDE.md exists to prevent.

What *is* extracted: two attributes whose evidence is the row itself,
verified by exact string equality (`domain/ver/entailment.py`) — the
strongest possible entailment, and genuinely real end-to-end enrichment
against the actual supplied dataset, not a fixture.
"""

from __future__ import annotations

from openspec.domain.model.attribute import (
    AttributeRef,
    AttributeValue,
    AttributeValueStatus,
    ProvenanceKind,
    SourceRowSpan,
    UnknownReason,
    attribute_value,
)
from openspec.domain.ver.entailment import verify_exact_match

MFG_PART_NUM_ATTRIBUTE = AttributeRef(
    code="MFG_PART_NUM",
    name="Manufacturer Part Number",
    datatype="string",
    risk_tier=1,
    is_mandatory=True,
)
ITEM_DESCRIPTION_ATTRIBUTE = AttributeRef(
    code="ITEM_DESCRIPTION",
    name="Item Description",
    datatype="string",
    risk_tier=1,
    is_mandatory=True,
)

_VERIFIER_NAME = "deterministic:source_row_verbatim_extractor"


def _extract_verbatim_field(
    *,
    id: str,
    attribute: AttributeRef,
    created_at: str,
    source_dataset: str,
    row_identifier: str,
    source_column: str,
    raw_value: str,
) -> AttributeValue:
    if not raw_value.strip():
        return attribute_value.unknown(
            id=id,
            attribute=attribute,
            created_at=created_at,
            reason=UnknownReason.SOURCE_FIELD_BLANK,
        )
    evidence = SourceRowSpan(
        source_dataset=source_dataset,
        row_identifier=row_identifier,
        source_column=source_column,
        snippet_text=raw_value,
    )
    verification = verify_exact_match(
        value_raw=raw_value, evidence_snippet=evidence.snippet_text, verifier_name=_VERIFIER_NAME
    )
    return attribute_value.extracted(
        id=id,
        attribute=attribute,
        created_at=created_at,
        status=AttributeValueStatus.ACCEPTED,
        value_display=raw_value,
        value_canonical=None,
        value_raw=raw_value,
        provenance_kind=ProvenanceKind.EXTRACTED,
        confidence=1.0,
        evidence=(evidence,),
        verification=verification,
    )


def extract_mfg_part_num(
    *,
    id: str,
    row_number: int,
    mfg_part_num: str,
    created_at: str,
    source_dataset: str = "sample_input.csv",
) -> AttributeValue:
    """Takes primitive row fields, not `infrastructure.reference_data.
    sample_input.SupplierInputRow` directly — `application/` may never import
    `infrastructure/` (`tests/architecture/test_layering.py`); the caller (a
    composition root) is responsible for unpacking the loaded row."""
    return _extract_verbatim_field(
        id=id,
        attribute=MFG_PART_NUM_ATTRIBUTE,
        created_at=created_at,
        source_dataset=source_dataset,
        row_identifier=str(row_number),
        source_column="Mfg_Part_Num",
        raw_value=mfg_part_num,
    )


def extract_item_description(
    *,
    id: str,
    row_number: int,
    part_desc: str,
    created_at: str,
    source_dataset: str = "sample_input.csv",
) -> AttributeValue:
    return _extract_verbatim_field(
        id=id,
        attribute=ITEM_DESCRIPTION_ATTRIBUTE,
        created_at=created_at,
        source_dataset=source_dataset,
        row_identifier=str(row_number),
        source_column="Part_Desc",
        raw_value=part_desc,
    )
