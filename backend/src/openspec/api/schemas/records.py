"""Wire DTOs for `GET /records` / `GET /records/{id}` (docs/api.md §Records).
Field-for-field match with `frontend/lib/contracts/record.ts`.
"""

from __future__ import annotations

from pydantic import BaseModel

from openspec.api.schemas.attribute_value import AttributeValueOut, attribute_value_from_domain
from openspec.application.ports.repositories import Completeness, RecordDetail, RecordSummary

RECORD_STATUSES = (
    "healthy",
    "incomplete",
    "partially_enriched",
    "awaiting_tier0_approval",
    "unknown_heavy",
    "class_unresolved",
    "unbound",
    "conflicting_sources",
)


def derive_record_status(summary: RecordSummary) -> str:
    """Computed, not stored (docs' own lesson, `frontend/mocks/fixtures/store.ts`'s
    `liveRecordSummary`: a status frozen at generation time goes stale the instant a
    review decision changes the attributes underneath it). Recomputed on every read
    from whatever `RecordSummary` the repository just handed back."""
    if summary.class_ref is None:
        return "class_unresolved"
    if not summary.has_document:
        return "unbound"
    if summary.tier0_pending_count > 0:
        return "awaiting_tier0_approval"
    c = summary.completeness
    if c.mandatory_total > 0 and summary.unknown_count / c.mandatory_total > 0.5:
        return "unknown_heavy"
    if summary.unknown_count > 0:
        return "incomplete"
    if c.pending_review > 0:
        return "partially_enriched"
    return "healthy"


class ClassRefOut(BaseModel):
    id: str
    code: str
    name: str
    confidence: float
    provenance_kind: str
    signal: str


class CompletenessOut(BaseModel):
    mandatory_total: int
    filled: int
    accepted: int
    pending_review: int
    unknown: int


def _completeness_out(c: Completeness) -> CompletenessOut:
    return CompletenessOut(
        mandatory_total=c.mandatory_total,
        filled=c.filled,
        accepted=c.accepted,
        pending_review=c.pending_review,
        unknown=c.unknown,
    )


class RecordSummaryOut(BaseModel):
    id: str
    mpn_raw: str
    description_raw: str
    supplier_name: str | None
    status: str
    class_: ClassRefOut | None
    completeness: CompletenessOut
    tier0_pending_count: int
    unknown_count: int
    has_document: bool
    created_at: str

    model_config = {"populate_by_name": True}

    def model_dump(self, **kwargs: object) -> dict[str, object]:
        data = super().model_dump(**kwargs)  # type: ignore[arg-type]
        data["class"] = data.pop("class_")
        return data


def record_summary_from_domain(summary: RecordSummary) -> RecordSummaryOut:
    return RecordSummaryOut(
        id=summary.record.id,
        mpn_raw=summary.record.mpn.raw,
        description_raw=summary.record.description_raw,
        supplier_name=summary.record.supplier_name,
        status=derive_record_status(summary),
        class_=(
            ClassRefOut(
                id=summary.class_ref.id,
                code=summary.class_ref.code,
                name=summary.class_ref.name,
                confidence=summary.class_ref.confidence,
                provenance_kind=summary.class_ref.provenance_kind,
                signal=summary.class_ref.signal,
            )
            if summary.class_ref
            else None
        ),
        completeness=_completeness_out(summary.completeness),
        tier0_pending_count=summary.tier0_pending_count,
        unknown_count=summary.unknown_count,
        has_document=summary.has_document,
        created_at=summary.record.created_at,
    )


class BindingOut(BaseModel):
    document_version_id: str
    region_id: str | None
    confidence: float
    signals: dict[str, object]


class RecordListOut(BaseModel):
    items: list[dict[str, object]]
    next_cursor: str | None


class RecordDetailOut(BaseModel):
    summary: RecordSummaryOut
    bindings: list[BindingOut]
    attributes: list[AttributeValueOut]

    def to_wire(self) -> dict[str, object]:
        """Flattens `summary` onto the top level, matching `recordDetailWireSchema`
        (`RecordSummary & { bindings, attributes }`) rather than a nested envelope."""
        body = self.summary.model_dump()
        body["bindings"] = [b.model_dump() for b in self.bindings]
        body["attributes"] = [a.model_dump() for a in self.attributes]
        return body


def record_detail_from_domain(detail: RecordDetail) -> RecordDetailOut:
    return RecordDetailOut(
        summary=record_summary_from_domain(detail.summary),
        bindings=[
            BindingOut(
                document_version_id=b.document_version_id,
                region_id=b.region_id,
                confidence=b.confidence,
                signals=b.signals,
            )
            for b in detail.bindings
        ],
        attributes=[attribute_value_from_domain(a) for a in detail.attributes],
    )
