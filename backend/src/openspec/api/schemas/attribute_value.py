"""Wire DTOs for `AttributeValue` (docs/api.md §Attribute values). Field-for-field
match with `frontend/lib/contracts/attribute-value.ts`'s `attributeValueWireSchema`
for the `DOCUMENT_SPAN` evidence kind — that file is the acceptance test for this
one, and the frontend is frozen: the fields it already parses
(`document_version_id`, `page`, `region_id`, `char_start`, `char_end`,
`snippet_text`, `bbox`) are unchanged. Pydantic models, not domain models on the
wire (docs/05-backend.md §5): `from_domain` is the single translation point.

**Evidence is a tagged union on the wire too (UH1).** `EvidenceOut` is one of
`DocumentSpanOut | SourceRowSpanOut | ReferenceTableRowOut`, discriminated by a
`kind` field. This is additive, not breaking: `zod`'s default (non-`strict`)
`z.object()` on the frontend silently drops fields it doesn't recognise, so an
extra `kind` key on an already-known `DOCUMENT_SPAN` payload does not fail the
frontend's existing parse (verified against `attribute-value.ts`, not assumed).
Nothing today actually emits `SOURCE_ROW_SPAN`/`REFERENCE_TABLE_ROW` evidence over
`GET /records` — the in-memory demo repository is document-sourced only — so the
live wire shape served today is byte-for-field identical to before this change,
modulo the additive `kind` key. See `docs/api.md` §Attribute values for the full
contract and the frontend-follow-up note.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from openspec.domain.model.attribute import (
    AttributeValue,
    AttributeValueUnknown,
    DocumentSpan,
    Evidence,
    ReferenceTableRow,
    SourceRowSpan,
    Verification,
)


class DocumentSpanOut(BaseModel):
    kind: Literal["DOCUMENT_SPAN"] = "DOCUMENT_SPAN"
    document_version_id: str
    page: int
    region_id: str
    char_start: int
    char_end: int
    snippet_text: str
    bbox: tuple[float, float, float, float]


class SourceRowSpanOut(BaseModel):
    kind: Literal["SOURCE_ROW_SPAN"] = "SOURCE_ROW_SPAN"
    source_dataset: str
    row_identifier: str
    source_column: str
    snippet_text: str


class ReferenceTableRowOut(BaseModel):
    kind: Literal["REFERENCE_TABLE_ROW"] = "REFERENCE_TABLE_ROW"
    reference_dataset: str
    row_key: str
    reference_field: str
    snippet_text: str


EvidenceOut = DocumentSpanOut | SourceRowSpanOut | ReferenceTableRowOut


class VerificationOut(BaseModel):
    verdict: str
    deterministic_check: str
    rationale: str
    verifier_model: str


class AttributeRefOut(BaseModel):
    code: str
    name: str
    datatype: str
    risk_tier: int
    is_mandatory: bool


class AttributeValueOut(BaseModel):
    id: str
    attribute: AttributeRefOut
    status: str
    value_display: str | None
    value_canonical: dict[str, object] | None
    value_raw: str | None
    unknown_reason: str | None
    provenance_kind: str | None
    confidence: float | None
    evidence: list[EvidenceOut]
    verification: VerificationOut | None
    created_at: str


def _evidence_out(e: Evidence) -> EvidenceOut:
    match e:
        case DocumentSpan():
            return DocumentSpanOut(
                document_version_id=e.document_version_id,
                page=e.page,
                region_id=e.region_id,
                char_start=e.char_start,
                char_end=e.char_end,
                snippet_text=e.snippet_text,
                bbox=e.bbox,
            )
        case SourceRowSpan():
            return SourceRowSpanOut(
                source_dataset=e.source_dataset,
                row_identifier=e.row_identifier,
                source_column=e.source_column,
                snippet_text=e.snippet_text,
            )
        case ReferenceTableRow():
            return ReferenceTableRowOut(
                reference_dataset=e.reference_dataset,
                row_key=e.row_key,
                reference_field=e.reference_field,
                snippet_text=e.snippet_text,
            )


def _verification_out(v: Verification) -> VerificationOut:
    return VerificationOut(
        verdict=v.verdict,
        deterministic_check=v.deterministic_check,
        rationale=v.rationale,
        verifier_model=v.verifier_model,
    )


def attribute_value_from_domain(value: AttributeValue) -> AttributeValueOut:
    ref = AttributeRefOut(
        code=value.attribute.code,
        name=value.attribute.name,
        datatype=value.attribute.datatype,
        risk_tier=value.attribute.risk_tier,
        is_mandatory=value.attribute.is_mandatory,
    )
    if isinstance(value, AttributeValueUnknown):
        return AttributeValueOut(
            id=value.id,
            attribute=ref,
            status=value.status.value,
            value_display=None,
            value_canonical=None,
            value_raw=None,
            unknown_reason=value.unknown_reason.value,
            provenance_kind=None,
            confidence=None,
            evidence=[],
            verification=None,
            created_at=value.created_at,
        )
    return AttributeValueOut(
        id=value.id,
        attribute=ref,
        status=value.status.value,
        value_display=value.value_display,
        value_canonical=value.value_canonical,
        value_raw=value.value_raw,
        unknown_reason=None,
        provenance_kind=value.provenance_kind.value,
        confidence=value.confidence,
        evidence=[_evidence_out(e) for e in value.evidence],
        verification=_verification_out(value.verification),
        created_at=value.created_at,
    )
