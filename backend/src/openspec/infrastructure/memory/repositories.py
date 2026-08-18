"""In-memory `RecordRepository` (docs/05-backend.md §4: "`cached`/`offline` modes are
a one-line adapter swap at the composition root"). This is that same pattern applied
to persistence rather than the LLM port: a deterministic, dependency-free adapter for
local dev, the test suite, and CI — not a substitute for the Postgres-targeted schema
in `infrastructure/db/models.py`, which is the production target
(docs/02-architecture.md §14 explicitly rejects SQLite: "no concurrency"). Swapping to
a real Postgres-backed repository is a composition-root change in `api/deps.py` only —
nothing above this port needs to change (docs/13-implementation-blueprint.md step 6).

Seed data deliberately dramatises the two domain traps CLAUDE.md calls out by name:
`ansi_class` is `Unknown(ATTRIBUTE_NOT_IN_DOCUMENT)` on the WOG-only record rather than
derived from `pressure_rating_wog` ("600 WOG ≠ Class 150 — never derive one from the
other"), and `nominal_size` is a designation, never unit-converted.
"""

from __future__ import annotations

from datetime import UTC, datetime

from openspec.application.ports.import_repository import (
    ImportBatchRepository,
    ImportBatchSummary,
    ImportRowError,
)
from openspec.application.ports.repositories import (
    BindingRef,
    RecordDetail,
    RecordRepository,
    RecordSummary,
)
from openspec.domain.model.attribute import (
    AttributeValue,
    AttributeValueStatus,
    DocumentSpan,
    ProvenanceKind,
    UnknownReason,
    Verification,
    attribute_value,
    is_unknown,
)
from openspec.domain.model.record import CatalogRecord, ClassRef, Mpn
from openspec.domain.sch.completeness import compute_completeness
from openspec.infrastructure.taxonomy_loader import TaxonomyClass, load_taxonomy

DEMO_TENANT_ID = "tenant_demo"
CANONICAL_RECORD_ID = "rec_demo_abc123"

_DOC_VERSION_ID = "docver_apollo_76a_series"


def _evidence(page: int, region: str, text: str) -> DocumentSpan:
    """This demo dataset is document-sourced only — see UH1 (`docs/16-unilog-
    alignment.md`) for the two additional evidence kinds this fixture doesn't
    exercise yet (no extraction pipeline runs against `SourceRowSpan`/
    `ReferenceTableRow` data until UH2+)."""
    return DocumentSpan(
        document_version_id=_DOC_VERSION_ID,
        page=page,
        region_id=region,
        char_start=0,
        char_end=len(text),
        snippet_text=text,
        bbox=(300.0, 470.0, 420.0, 496.0),
    )


def _verification(rationale: str) -> Verification:
    return Verification(
        verdict="ENTAILED",
        deterministic_check="exact",
        rationale=rationale,
        verifier_model="cached-verifier-v1",
    )


# code -> (status, value_display, value_canonical, value_raw, provenance) for the
# fully-enriched demo record. Anything not listed here is emitted as
# Unknown(ATTRIBUTE_NOT_IN_DOCUMENT) — including `ansi_class`, deliberately: the
# source document states 600 WOG, and WOG cannot be derived into an ANSI Class
# (CLAUDE.md domain trap).
OverrideValue = tuple[AttributeValueStatus, str, dict[str, object], str, ProvenanceKind]
_ABC123_VALUES: dict[str, OverrideValue] = {
    "nominal_size": (
        AttributeValueStatus.ACCEPTED,
        "NPS 1/2",
        {"designation": "NPS", "size": "1/2"},
        "1/2",
        ProvenanceKind.EXTRACTED,
    ),
    "body_material": (
        AttributeValueStatus.ACCEPTED,
        "Bronze",
        {"value": "BRONZE"},
        "BRZ",
        ProvenanceKind.EXTRACTED,
    ),
    "end_connection_inlet": (
        AttributeValueStatus.ACCEPTED,
        "FNPT",
        {"value": "FNPT"},
        "FIP",
        ProvenanceKind.DERIVED,  # FIP ~= FNPT, synonym derivation (CLAUDE.md)
    ),
    "pressure_rating_wog": (
        AttributeValueStatus.NEEDS_APPROVAL,  # Tier 0 — INV-9, never auto-accepted
        "600 psi",
        {"magnitude": 600, "unit": "psi", "media": "WOG"},
        "600 WOG",
        ProvenanceKind.EXTRACTED,
    ),
    "seat_material": (
        AttributeValueStatus.ACCEPTED,
        "PTFE",
        {"value": "PTFE"},
        "PTFE",
        ProvenanceKind.EXTRACTED,
    ),
    "handle_type": (
        AttributeValueStatus.ACCEPTED,
        "Lever",
        {"value": "LEVER"},
        "LEVER HANDLE",
        ProvenanceKind.EXTRACTED,
    ),
    "lead_free_compliance": (
        AttributeValueStatus.NEEDS_APPROVAL,  # Tier 0
        "Yes",
        {"value": True},
        "LEAD FREE",
        ProvenanceKind.EXTRACTED,
    ),
}


def _build_attribute_values(
    record_id: str, taxonomy_class: TaxonomyClass, overrides: dict[str, OverrideValue] | None
) -> tuple[AttributeValue, ...]:
    overrides = overrides or {}
    values: list[AttributeValue] = []
    for idx, attr in enumerate(taxonomy_class.attributes):
        av_id = f"av_{record_id}_{attr.code}"
        created_at = "2026-08-01T09:00:00Z"
        if attr.code in overrides:
            status, display, canonical, raw, provenance = overrides[attr.code]
            values.append(
                attribute_value.extracted(
                    id=av_id,
                    attribute=attr,
                    created_at=created_at,
                    status=status,
                    value_display=display,
                    value_canonical=canonical,
                    value_raw=raw,
                    provenance_kind=provenance,
                    confidence=0.94,
                    evidence=(_evidence(2, f"table:1/row:14/cell:{idx}", raw),),
                    verification=_verification(
                        "Row 14 corresponds to catalog no. 70-104-01, matching the queried MPN."
                    ),
                )
            )
        else:
            values.append(
                attribute_value.unknown(
                    id=av_id,
                    attribute=attr,
                    created_at=created_at,
                    reason=UnknownReason.ATTRIBUTE_NOT_IN_DOCUMENT,
                )
            )
    return tuple(values)


class InMemoryRecordRepository(RecordRepository, ImportBatchRepository):
    """Builds its fixed, deterministic dataset once at construction — no clock, no
    randomness, so the same process always serves the same demo data (INV-10's
    reproducibility spirit, applied to a dev fixture rather than a real run).

    Also implements `ImportBatchRepository` (docs/13-implementation-blueprint.md
    step 8, `ING`): a single in-process store plays both the read-only demo-data
    role and the write path new imports land in — the same "fast, free,
    deterministic dev/test adapter" role this class's own module docstring
    already describes, extended to cover mutation now that `ING` needs one. A
    freshly-ingested record is unenriched (`class_ref=None`, no attribute
    values) — `CLS`/`EXT` haven't run yet, honestly reflected rather than
    faked with placeholder attributes."""

    def __init__(self) -> None:
        taxonomy = load_taxonomy()
        ball_valve = taxonomy["BALL_VALVE_BRONZE"]
        self._details: dict[str, RecordDetail] = {}
        self._batches: dict[str, ImportBatchSummary] = {}

        abc123_values = _build_attribute_values(CANONICAL_RECORD_ID, ball_valve, _ABC123_VALUES)
        self._details[CANONICAL_RECORD_ID] = RecordDetail(
            summary=RecordSummary(
                record=CatalogRecord(
                    id=CANONICAL_RECORD_ID,
                    tenant_id=DEMO_TENANT_ID,
                    mpn=Mpn(raw="ABC-123", canonical="ABC123"),
                    description_raw="1/2 BRS BALL VLV 600WOG",
                    supplier_name="Apollo",
                    source_batch_id="batch_seed",
                    created_at="2026-08-01T09:00:00Z",
                ),
                class_ref=ClassRef(
                    id="cls_ball_valve_bronze",
                    code="BALL_VALVE_BRONZE",
                    name="Ball Valve, Bronze/Brass",
                    confidence=0.97,
                    provenance_kind="DERIVED",
                    signal="rule+llm",
                ),
                completeness=compute_completeness(abc123_values),
                tier0_pending_count=sum(
                    1
                    for v in abc123_values
                    if v.attribute.risk_tier == 0
                    and v.status is AttributeValueStatus.NEEDS_APPROVAL
                ),
                unknown_count=sum(1 for v in abc123_values if is_unknown(v)),
                has_document=True,
            ),
            attributes=abc123_values,
            bindings=(
                BindingRef(
                    document_version_id=_DOC_VERSION_ID,
                    region_id="table:1/row:14",
                    confidence=0.98,
                    signals={"exact_mpn_hit": True, "supplier_match": True},
                ),
            ),
        )

        unbound_id = "rec_demo_xyz789"
        unbound_values = _build_attribute_values(unbound_id, ball_valve, overrides=None)
        self._details[unbound_id] = RecordDetail(
            summary=RecordSummary(
                record=CatalogRecord(
                    id=unbound_id,
                    tenant_id=DEMO_TENANT_ID,
                    mpn=Mpn(raw="XYZ-789", canonical="XYZ789"),
                    description_raw="3/4 SS316 BALL VLV",
                    supplier_name="Nibco",
                    source_batch_id="batch_seed",
                    created_at="2026-08-02T09:00:00Z",
                ),
                class_ref=None,
                completeness=compute_completeness(unbound_values),
                tier0_pending_count=0,
                unknown_count=sum(1 for v in unbound_values if is_unknown(v)),
                has_document=False,
            ),
            attributes=unbound_values,
            bindings=(),
        )

    def list_summaries(
        self, *, tenant_id: str, cursor: int, limit: int
    ) -> tuple[list[RecordSummary], int | None]:
        all_summaries = [
            d.summary for d in self._details.values() if d.summary.record.tenant_id == tenant_id
        ]
        page = all_summaries[cursor : cursor + limit]
        next_offset = cursor + limit if cursor + limit < len(all_summaries) else None
        return page, next_offset

    def get_detail(self, *, tenant_id: str, record_id: str) -> RecordDetail | None:
        detail = self._details.get(record_id)
        if detail is None or detail.summary.record.tenant_id != tenant_id:
            return None
        return detail

    # ---- ImportBatchRepository (ING write path) -----------------------------

    def create_batch(
        self, *, id: str, tenant_id: str, filename: str, raw_blob_key: str, created_by: str
    ) -> None:
        self._batches[id] = ImportBatchSummary(
            id=id,
            tenant_id=tenant_id,
            filename=filename,
            row_count=0,
            error_count=0,
            created_at=datetime.now(UTC).isoformat(),
            errors=(),
        )

    def add_record(self, *, batch_id: str, record: CatalogRecord) -> None:
        unenriched_values: tuple[AttributeValue, ...] = ()
        self._details[record.id] = RecordDetail(
            summary=RecordSummary(
                record=record,
                class_ref=None,  # CLS hasn't run — an honest "not classified yet"
                completeness=compute_completeness(unenriched_values),
                tier0_pending_count=0,
                unknown_count=0,
                has_document=False,
            ),
            attributes=unenriched_values,
            bindings=(),
        )

    def add_row_error(self, *, batch_id: str, error: ImportRowError) -> None:
        existing = self._batches[batch_id]
        self._batches[batch_id] = ImportBatchSummary(
            id=existing.id,
            tenant_id=existing.tenant_id,
            filename=existing.filename,
            row_count=existing.row_count,
            error_count=existing.error_count,
            created_at=existing.created_at,
            errors=(*existing.errors, error),
        )

    def finalize_batch(self, *, batch_id: str, row_count: int, error_count: int) -> None:
        existing = self._batches[batch_id]
        self._batches[batch_id] = ImportBatchSummary(
            id=existing.id,
            tenant_id=existing.tenant_id,
            filename=existing.filename,
            row_count=row_count,
            error_count=error_count,
            created_at=existing.created_at,
            errors=existing.errors,
        )

    def get_batch(self, *, tenant_id: str, batch_id: str) -> ImportBatchSummary | None:
        batch = self._batches.get(batch_id)
        if batch is None or batch.tenant_id != tenant_id:
            return None
        return batch
