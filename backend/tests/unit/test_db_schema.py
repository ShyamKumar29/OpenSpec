"""Schema-shape tests for `infrastructure/db/models.py`'s `EvidenceRow` (UH1).

No live Postgres in this environment (`docs/15-backend-implementation-status.md`
§3) — these tests compile the DDL against the Postgres dialect and inspect the
compiled SQL / table metadata directly, proving the widened evidence schema is
well-formed without needing a running database. This makes permanent what a
previous session verified ad hoc for the pre-UH1 schema.
"""

from __future__ import annotations

from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable

from openspec.infrastructure.db.models import EvidenceRow


def _compiled_ddl() -> str:
    return str(CreateTable(EvidenceRow.__table__).compile(dialect=postgresql.dialect()))


def test_evidence_table_compiles_against_postgres_dialect() -> None:
    ddl = _compiled_ddl()
    assert "CREATE TABLE evidence" in ddl


def test_evidence_table_has_kind_discriminator_check() -> None:
    ddl = _compiled_ddl()
    assert "ck_evidence_kind_enum" in ddl
    assert "DOCUMENT_SPAN" in ddl
    assert "SOURCE_ROW_SPAN" in ddl
    assert "REFERENCE_TABLE_ROW" in ddl


def test_evidence_table_has_kind_field_shape_check() -> None:
    ddl = _compiled_ddl()
    assert "ck_evidence_kind_field_shape" in ddl


def test_evidence_table_document_span_columns_are_now_nullable() -> None:
    """UH1 widened the union, so a DOCUMENT_SPAN-only column can no longer be
    NOT NULL at the column level — the field-shape CHECK constraint carries that
    requirement instead, conditional on `kind`."""
    table = EvidenceRow.__table__
    for col_name in ("document_version_id", "region_id", "page", "char_start", "char_end", "bbox"):
        assert table.c[col_name].nullable, f"{col_name} must be nullable for non-DOCUMENT_SPAN rows"


def test_evidence_table_new_variant_columns_are_nullable() -> None:
    table = EvidenceRow.__table__
    for col_name in (
        "source_dataset",
        "row_identifier",
        "source_column",
        "reference_dataset",
        "row_key",
        "reference_field",
    ):
        assert table.c[col_name].nullable


def test_evidence_table_kind_and_snippet_text_are_required_for_every_kind() -> None:
    table = EvidenceRow.__table__
    assert not table.c["kind"].nullable
    assert not table.c["snippet_text"].nullable
