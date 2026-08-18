"""SQLAlchemy 2.0 models — the Postgres-targeted schema from docs/04-data-model.md §3,
transcribed table-for-table with its `CHECK` constraints. **Not exercised by the test
suite in this milestone**: this sandbox has no Docker/Postgres available, and
docs/02-architecture.md §14 explicitly rejects SQLite ("no concurrency") as a stand-in,
so these models are reviewed by inspection rather than by an integration test today.
See `docs/15-backend-implementation-status.md` for exactly what that means and what
the next session should do first (`alembic init` + `alembic revision --autogenerate`
against this file, against a real Postgres).

Only the tables needed to reason about the read-side vertical slice (`GET /records`,
`GET /records/{id}`) plus the tables that carry the ten invariants as constraints are
modelled here. `review_task`/`review_action`, `gold_label`, `eval_*` follow when
`RVW`/`EVL` are built (docs/13-implementation-blueprint.md steps 9, 14).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Index,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


# ---- Input side (immutable) — docs/04-data-model.md §3.1 -------------------------


class ImportBatch(Base):
    __tablename__ = "import_batch"

    id: Mapped[uuid.UUID] = _uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    filename: Mapped[str]
    row_count: Mapped[int]
    error_count: Mapped[int] = mapped_column(default=0)
    raw_blob_key: Mapped[str]
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class ImportErrorRow(Base):
    """`import_error` (docs/04-data-model.md §3.1: "Per-row rejection report
    (FR-ING-6)"). M0's `ING` module (`application/stages/ing.py`,
    `application/usecases/ingest_batch.py`) writes one of these per row it
    could not import — the same shape `ImportRowError`
    (`application/ports/import_repository.py`) already carries for the
    in-memory adapter, transcribed here for the Postgres one once it exists."""

    __tablename__ = "import_error"

    id: Mapped[uuid.UUID] = _uuid_pk()
    batch_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("import_batch.id"))
    row_number: Mapped[int]
    raw_row: Mapped[str]
    error_code: Mapped[str]
    message: Mapped[str]

    __table_args__ = (Index("ix_import_error_batch", "batch_id"),)


class CatalogRecordRow(Base):
    """Never mutated after insert (docs §3.1) — all enrichment output references it
    by FK; nothing here is ever `UPDATE`d by application code."""

    __tablename__ = "catalog_record"

    id: Mapped[uuid.UUID] = _uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    mpn_raw: Mapped[str]
    mpn_canonical: Mapped[str]
    description_raw: Mapped[str]
    supplier_name: Mapped[str | None]
    uom: Mapped[str | None]
    source_batch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("import_batch.id")
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    deleted_at: Mapped[datetime | None]  # INV-8: soft delete only, no DELETE

    __table_args__ = (
        Index("ix_catalog_record_tenant_mpn_canonical", "tenant_id", "mpn_canonical"),
    )


# ---- Taxonomy & schema (versioned, loaded from resources/) — §3.2 ----------------


class TaxonomyClassRow(Base):
    __tablename__ = "taxonomy_class"

    id: Mapped[uuid.UUID] = _uuid_pk()
    code: Mapped[str] = mapped_column(unique=True)
    name: Mapped[str]
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("taxonomy_class.id")
    )
    external_ref: Mapped[str | None]
    schema_version: Mapped[str]

    attributes: Mapped[list[AttributeDefinitionRow]] = relationship(back_populates="taxonomy_class")


class AttributeDefinitionRow(Base):
    __tablename__ = "attribute_definition"

    id: Mapped[uuid.UUID] = _uuid_pk()
    class_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("taxonomy_class.id"))
    code: Mapped[str]
    name: Mapped[str]
    datatype: Mapped[str]
    unit_dimension: Mapped[str | None]
    is_mandatory: Mapped[bool] = mapped_column(default=True)
    risk_tier: Mapped[int]
    schema_version: Mapped[str]

    taxonomy_class: Mapped[TaxonomyClassRow] = relationship(back_populates="attributes")

    __table_args__ = (
        CheckConstraint("risk_tier IN (0, 1, 2, 3)", name="ck_attribute_definition_risk_tier"),
        UniqueConstraint("class_id", "code", "schema_version", name="uq_attribute_definition_code"),
    )


# ---- Document side (content-addressed) — §3.3 -------------------------------------


class DocumentRow(Base):
    __tablename__ = "document"

    id: Mapped[uuid.UUID] = _uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    publisher: Mapped[str]
    title: Mapped[str]
    source_url: Mapped[str | None]
    doc_type: Mapped[str]
    first_seen_at: Mapped[datetime] = mapped_column(server_default=func.now())


class DocumentVersionRow(Base):
    """Identity = `content_hash`. Re-fetching identical bytes creates nothing new —
    the parse cache is correct by construction (docs §3.3)."""

    __tablename__ = "document_version"

    id: Mapped[uuid.UUID] = _uuid_pk()
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("document.id"))
    content_hash: Mapped[str] = mapped_column(unique=True)
    blob_key: Mapped[str]
    page_count: Mapped[int]
    fetched_at: Mapped[datetime] = mapped_column(server_default=func.now())
    effective_date: Mapped[datetime | None]
    fetch_policy_ok: Mapped[bool]


class ParseArtifactRow(Base):
    """Cache key = `(content_hash, parser_version)` — a parser upgrade produces a new
    artifact; old evidence still resolves against the artifact it was created under."""

    __tablename__ = "parse_artifact"

    id: Mapped[uuid.UUID] = _uuid_pk()
    document_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("document_version.id")
    )
    parser_name: Mapped[str]
    parser_version: Mapped[str]
    blob_key: Mapped[str]
    parse_quality: Mapped[float | None]
    has_text_layer: Mapped[bool]
    used_ocr: Mapped[bool] = mapped_column(default=False)

    __table_args__ = (
        UniqueConstraint("document_version_id", "parser_version", name="uq_parse_artifact_version"),
    )


class DocumentRegionRow(Base):
    """Stable structural addressing (`path`, e.g. `table:4/row:14/cell:3`) — the
    anchor every `DOCUMENT_SPAN`-kind evidence row's `region_id` points at (UH1:
    `SOURCE_ROW_SPAN`/`REFERENCE_TABLE_ROW` evidence has no region — see
    `EvidenceRow`)."""

    __tablename__ = "document_region"

    id: Mapped[uuid.UUID] = _uuid_pk()
    parse_artifact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("parse_artifact.id")
    )
    region_type: Mapped[str]
    page: Mapped[int]
    bbox: Mapped[list[float]] = mapped_column(JSONB)
    path: Mapped[str]
    text: Mapped[str | None]
    parent_region_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("document_region.id")
    )

    __table_args__ = (Index("ix_document_region_parse_artifact", "parse_artifact_id"),)


class DocumentBindingRow(Base):
    """Row-level binding for family documents (FR-DOC-3). `signals` stores the full
    retrieval-hierarchy breakdown (exact -> normalised -> supplier -> class -> overlap
    -> LLM disambiguation)."""

    __tablename__ = "document_binding"

    id: Mapped[uuid.UUID] = _uuid_pk()
    record_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("catalog_record.id")
    )
    document_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("document_version.id")
    )
    region_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("document_region.id")
    )
    confidence: Mapped[float]
    signals: Mapped[dict[str, object]] = mapped_column(JSONB)
    method: Mapped[str]
    created_by_kind: Mapped[str]  # "system" | "human"
    deleted_at: Mapped[datetime | None]  # detach = soft delete (INV-8)


# ---- Output side (append-only, the heart) — §3.4 ----------------------------------


class AttributeValueRow(Base):
    """The central table. Every `CHECK` here is an invariant made physically
    impossible to violate, not a convention (docs §3.4's own framing: "showing a
    database constraint is a different class of answer from showing an `if`
    statement" for INV-9)."""

    __tablename__ = "attribute_value"

    id: Mapped[uuid.UUID] = _uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    record_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("catalog_record.id")
    )
    attribute_definition_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("attribute_definition.id")
    )

    status: Mapped[str]
    value_raw: Mapped[str | None]
    value_canonical: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    value_display: Mapped[str | None]
    unit_canonical: Mapped[str | None]
    unit_display: Mapped[str | None]
    unknown_reason: Mapped[str | None]
    provenance_kind: Mapped[str]
    confidence: Mapped[float | None]
    confidence_signals: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    risk_tier: Mapped[int]

    run_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    schema_version: Mapped[str]
    ruleset_version: Mapped[str | None]
    prompt_version: Mapped[str | None]
    extractor_model: Mapped[str | None]
    verifier_model: Mapped[str | None]
    # `use_alter=True`: `attribute_value` <-> `verification` is a genuine
    # mutual FK cycle (a value points at the verification that let it become
    # ACCEPTED; a verification points at the value it verified). SQLAlchemy
    # can't topologically order `CREATE TABLE`s across a cycle — without
    # `use_alter`, `Base.metadata.create_all()`/`drop_all()` (what
    # `alembic/versions/0001_initial.py` calls) emits a `SAWarning` and
    # silently drops *all* FK constraints between the two tables, which is
    # far worse than the cycle itself. `use_alter` defers this FK to a
    # separate `ALTER TABLE ... ADD CONSTRAINT` emitted after every table
    # exists, breaking the ordering deadlock while keeping the constraint.
    verification_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("verification.id", use_alter=True, name="fk_attribute_value_verification_id"),
    )

    superseded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("attribute_value.id")
    )
    is_current: Mapped[bool] = mapped_column(default=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    created_by_actor: Mapped[str]

    __table_args__ = (
        CheckConstraint(
            "status <> 'UNKNOWN' OR unknown_reason IS NOT NULL",
            name="ck_attribute_value_inv4_unknown_reason",
        ),
        CheckConstraint(
            "status <> 'ACCEPTED' OR verification_id IS NOT NULL",
            name="ck_attribute_value_inv2_verified",
        ),
        CheckConstraint(
            "status <> 'ACCEPTED' OR risk_tier <> 0",
            name="ck_attribute_value_inv9_tier0_never_accepted",
        ),
        CheckConstraint(
            "status = 'UNKNOWN' OR value_raw IS NOT NULL",
            name="ck_attribute_value_asserted_has_raw",
        ),
        # INV-1 itself (>=1 evidence row per current non-UNKNOWN value) is a
        # deferred, statement-level constraint that can't be expressed as a column
        # CHECK — it needs a trigger or an EXCLUDE-style deferred FK pattern. Tracked
        # as the first item under infrastructure/db in
        # docs/15-backend-implementation-status.md rather than guessed at here.
        Index(
            "uq_attribute_value_one_current",
            "record_id",
            "attribute_definition_id",
            unique=True,
            postgresql_where=text("is_current"),
        ),
        Index(
            "ix_attribute_value_record_current",
            "record_id",
            postgresql_where=text("is_current"),
        ),
        Index("ix_attribute_value_review_queue", "tenant_id", "status", "risk_tier", "confidence"),
    )


class EvidenceRow(Base):
    """UH1 (`docs/16-unilog-alignment.md` G1): `evidence` now persists a tagged
    union — `kind ∈ {DOCUMENT_SPAN, SOURCE_ROW_SPAN, REFERENCE_TABLE_ROW}` — instead
    of assuming every row points at a document. This is the smallest schema change
    consistent with the existing design: the original document-span columns become
    nullable, two new nullable column groups are added for the other two kinds, and
    a single `CHECK` constraint (`ck_evidence_kind_field_shape`) enforces that
    exactly the right group is populated for a row's `kind` — the DB-level mirror of
    each `Evidence` variant's `__post_init__` in `domain/model/attribute.py`.

    Not run against a live Postgres in this environment (see class docstring at the
    top of this module for why); `tests/unit/test_db_schema.py` compiles this DDL
    against the Postgres dialect and inspects the compiled SQL/table metadata so the
    schema is still proven correct without one.
    """

    __tablename__ = "evidence"

    id: Mapped[uuid.UUID] = _uuid_pk()
    attribute_value_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("attribute_value.id"), nullable=False
    )
    kind: Mapped[str]  # "DOCUMENT_SPAN" | "SOURCE_ROW_SPAN" | "REFERENCE_TABLE_ROW"

    # DOCUMENT_SPAN fields — required when kind='DOCUMENT_SPAN', NULL otherwise.
    document_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("document_version.id")
    )
    region_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("document_region.id")
    )
    page: Mapped[int | None]
    char_start: Mapped[int | None]
    char_end: Mapped[int | None]
    bbox: Mapped[list[float] | None] = mapped_column(JSONB)

    # SOURCE_ROW_SPAN fields (UH1) — a value read from the supplier/input row
    # itself. Required when kind='SOURCE_ROW_SPAN', NULL otherwise. Named
    # `source_column`/`row_identifier` (not the domain's bare `column`) to avoid any
    # ambiguity with a SQL reserved word at the DDL layer.
    source_dataset: Mapped[str | None]
    row_identifier: Mapped[str | None]
    source_column: Mapped[str | None]

    # REFERENCE_TABLE_ROW fields (UH1) — a value read from an approved, curated
    # reference table/LOV, distinct from a raw supplier-submitted row. Required when
    # kind='REFERENCE_TABLE_ROW', NULL otherwise.
    reference_dataset: Mapped[str | None]
    row_key: Mapped[str | None]
    reference_field: Mapped[str | None]

    # Stored verbatim and redundantly (docs §3.4), regardless of kind — provenance
    # survives a parser upgrade / reference-table reload even if the region or row
    # it originally pointed at is later reparsed or re-supplied.
    snippet_text: Mapped[str]
    context_shown: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    rank: Mapped[int] = mapped_column(default=0)

    __table_args__ = (
        CheckConstraint(
            "kind IN ('DOCUMENT_SPAN', 'SOURCE_ROW_SPAN', 'REFERENCE_TABLE_ROW')",
            name="ck_evidence_kind_enum",
        ),
        CheckConstraint(
            "char_start IS NULL OR char_end >= char_start", name="ck_evidence_span_order"
        ),
        CheckConstraint("page IS NULL OR page >= 1", name="ck_evidence_page_positive"),
        # UH1: exactly one variant's field group is populated per row, matching the
        # `kind` discriminator.
        CheckConstraint(
            "(kind = 'DOCUMENT_SPAN'"
            "  AND document_version_id IS NOT NULL AND region_id IS NOT NULL"
            "  AND page IS NOT NULL AND char_start IS NOT NULL AND char_end IS NOT NULL"
            "  AND bbox IS NOT NULL"
            "  AND source_dataset IS NULL AND row_identifier IS NULL AND source_column IS NULL"
            "  AND reference_dataset IS NULL AND row_key IS NULL AND reference_field IS NULL)"
            " OR "
            "(kind = 'SOURCE_ROW_SPAN'"
            "  AND source_dataset IS NOT NULL AND row_identifier IS NOT NULL"
            "  AND source_column IS NOT NULL"
            "  AND document_version_id IS NULL AND region_id IS NULL AND page IS NULL"
            "  AND char_start IS NULL AND char_end IS NULL AND bbox IS NULL"
            "  AND reference_dataset IS NULL AND row_key IS NULL AND reference_field IS NULL)"
            " OR "
            "(kind = 'REFERENCE_TABLE_ROW'"
            "  AND reference_dataset IS NOT NULL AND row_key IS NOT NULL"
            "  AND reference_field IS NOT NULL"
            "  AND document_version_id IS NULL AND region_id IS NULL AND page IS NULL"
            "  AND char_start IS NULL AND char_end IS NULL AND bbox IS NULL"
            "  AND source_dataset IS NULL AND row_identifier IS NULL AND source_column IS NULL)",
            name="ck_evidence_kind_field_shape",
        ),
    )


class VerificationRow(Base):
    __tablename__ = "verification"

    id: Mapped[uuid.UUID] = _uuid_pk()
    attribute_value_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("attribute_value.id")
    )
    verdict: Mapped[str]
    rationale: Mapped[str]
    verifier_model: Mapped[str]
    prompt_version: Mapped[str]
    deterministic_check: Mapped[str]
    dual_model_agreement: Mapped[bool | None]

    __table_args__ = (
        CheckConstraint(
            "verdict IN ('ENTAILED', 'PARTIAL', 'NOT_ENTAILED')", name="ck_verification_verdict"
        ),
    )


class TransformStepRow(Base):
    __tablename__ = "transform_step"

    id: Mapped[uuid.UUID] = _uuid_pk()
    attribute_value_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("attribute_value.id")
    )
    seq: Mapped[int]
    rule_id: Mapped[str]
    input_value: Mapped[str]
    output_value: Mapped[str]
    note: Mapped[str | None]


# ---- Process & audit — §3.5 --------------------------------------------------------


class EnrichmentRunRow(Base):
    __tablename__ = "enrichment_run"

    id: Mapped[uuid.UUID] = _uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    kind: Mapped[str]  # "batch" | "single" | "judge"
    config_snapshot: Mapped[dict[str, object]] = mapped_column(JSONB)
    corpus_hash: Mapped[str | None]
    started_at: Mapped[datetime] = mapped_column(server_default=func.now())
    finished_at: Mapped[datetime | None]
    cost_total: Mapped[float | None]
    token_total: Mapped[int | None]


class StageExecutionRow(Base):
    __tablename__ = "stage_execution"

    id: Mapped[uuid.UUID] = _uuid_pk()
    run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("enrichment_run.id"))
    record_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("catalog_record.id")
    )
    stage: Mapped[str]
    state: Mapped[str]
    attempt: Mapped[int] = mapped_column(default=1)
    started_at: Mapped[datetime] = mapped_column(server_default=func.now())
    duration_ms: Mapped[int | None]
    error_code: Mapped[str | None]


class LlmCallRow(Base):
    __tablename__ = "llm_call"

    id: Mapped[uuid.UUID] = _uuid_pk()
    run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("enrichment_run.id"))
    record_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("catalog_record.id")
    )
    stage: Mapped[str]
    model: Mapped[str]
    prompt_version: Mapped[str]
    tokens_in: Mapped[int]
    tokens_out: Mapped[int]
    cached_tokens: Mapped[int] = mapped_column(default=0)
    cost_usd: Mapped[float]
    latency_ms: Mapped[int]
    outcome: Mapped[str]
    request_hash: Mapped[str]

    __table_args__ = (Index("ix_llm_call_request_hash", "request_hash"),)


class AuditEventRow(Base):
    """Append-only, no updates, no deletes (INV-8) — there is deliberately no
    `deleted_at` column here; the table itself is the immutable record."""

    __tablename__ = "audit_event"

    id: Mapped[uuid.UUID] = _uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    entity_type: Mapped[str]
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    action: Mapped[str]
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    actor_kind: Mapped[str]  # "human" | "system"
    before: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    after: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    cause: Mapped[str | None]
    occurred_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        Index("ix_audit_event_entity_lineage", "entity_type", "entity_id", "occurred_at"),
    )


class JobRow(Base):
    """Postgres-backed queue (docs/02-architecture.md §9). Claimed via
    `SELECT ... FOR UPDATE SKIP LOCKED` — that query lives in the (not-yet-built)
    `infrastructure/queue/postgres_queue.py`, not here; this is the table shape only.
    """

    __tablename__ = "job"

    id: Mapped[uuid.UUID] = _uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    type: Mapped[str]
    payload: Mapped[dict[str, object]] = mapped_column(JSONB)
    dedupe_key: Mapped[str] = mapped_column(unique=True)
    state: Mapped[str] = mapped_column(default="queued")
    attempts: Mapped[int] = mapped_column(default=0)
    next_attempt_at: Mapped[datetime] = mapped_column(server_default=func.now())
    locked_by: Mapped[str | None]
    locked_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        Index(
            "ix_job_claim",
            "state",
            "next_attempt_at",
            postgresql_where=text("state = 'queued'"),
        ),
    )


# ---- Review — §3.6 -----------------------------------------------------------------


class ReviewTaskRow(Base):
    __tablename__ = "review_task"

    id: Mapped[uuid.UUID] = _uuid_pk()
    attribute_value_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("attribute_value.id")
    )
    record_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("catalog_record.id")
    )
    reason_code: Mapped[str]
    risk_tier: Mapped[int]
    priority: Mapped[int] = mapped_column(default=0)
    state: Mapped[str] = mapped_column(default="open")  # open|claimed|resolved|skipped
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    opened_at: Mapped[datetime] = mapped_column(server_default=func.now())
    closed_at: Mapped[datetime | None]


class ReviewActionRow(Base):
    __tablename__ = "review_action"

    id: Mapped[uuid.UUID] = _uuid_pk()
    task_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("review_task.id"))
    actor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    action: Mapped[str]  # accept|reject|correct|approve
    value_before: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    value_after: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    reason: Mapped[str | None]
    duration_ms: Mapped[int]  # powers the throughput metric (FR-RVW-9)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
