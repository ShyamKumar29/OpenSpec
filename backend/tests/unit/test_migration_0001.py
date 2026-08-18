"""`alembic/versions/0001_initial.py` (docs/10-roadmap.md M0). No live Postgres
in this environment (docs/15-backend-implementation-status.md §3) — this
compiles every table in `Base.metadata` against the Postgres dialect and
inspects the resulting DDL, the same discipline `test_db_schema.py` already
established for `EvidenceRow` alone, generalised to the whole schema.
"""

from __future__ import annotations

from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable

from openspec.infrastructure.db.models import Base

# Every INV-bearing named CHECK/UNIQUE constraint declared across
# infrastructure/db/models.py's __table_args__ — asserted present in the
# migration's target metadata so a future edit to models.py that silently
# drops one fails this test, not a live-DB integration test that can't run
# here.
EXPECTED_CONSTRAINT_NAMES = (
    "ck_attribute_definition_risk_tier",
    "uq_attribute_definition_code",
    "ck_attribute_value_inv4_unknown_reason",
    "ck_attribute_value_inv2_verified",
    "ck_attribute_value_inv9_tier0_never_accepted",
    "ck_attribute_value_asserted_has_raw",
    "ck_evidence_kind_enum",
    "ck_evidence_span_order",
    "ck_evidence_page_positive",
    "ck_evidence_kind_field_shape",
    "ck_verification_verdict",
)


def _compiled_ddl_for_every_table() -> str:
    dialect = postgresql.dialect()
    return "\n".join(
        str(CreateTable(table).compile(dialect=dialect)) for table in Base.metadata.sorted_tables
    )


def test_every_model_table_is_in_base_metadata() -> None:
    # `alembic/versions/0001_initial.py` creates exactly `Base.metadata`'s
    # tables — this is really a sanity check that the models module hasn't
    # somehow left a table class unregistered (e.g. wrong Base import).
    expected_tables = {
        "import_batch",
        "import_error",
        "catalog_record",
        "taxonomy_class",
        "attribute_definition",
        "document",
        "document_version",
        "parse_artifact",
        "document_region",
        "document_binding",
        "attribute_value",
        "evidence",
        "verification",
        "transform_step",
        "enrichment_run",
        "stage_execution",
        "llm_call",
        "audit_event",
        "job",
        "review_task",
        "review_action",
    }
    assert expected_tables <= set(Base.metadata.tables)


def test_migration_ddl_compiles_against_postgres_dialect_for_every_table() -> None:
    for table in Base.metadata.sorted_tables:
        ddl = str(CreateTable(table).compile(dialect=postgresql.dialect()))
        assert f"CREATE TABLE {table.name}" in ddl


def test_every_inv_constraint_survives_into_the_compiled_migration_ddl() -> None:
    ddl = _compiled_ddl_for_every_table()
    missing = [name for name in EXPECTED_CONSTRAINT_NAMES if name not in ddl]
    assert not missing, f"constraint(s) missing from compiled DDL: {missing}"


def test_tables_are_topologically_sortable_by_foreign_key_dependency() -> None:
    """`create_all`/`drop_all` (what `upgrade`/`downgrade` call) both depend on
    SQLAlchemy being able to order tables by FK dependency — this fails loudly
    at import time if models.py ever introduces a dependency cycle."""
    ordered = Base.metadata.sorted_tables
    assert len(ordered) == len(Base.metadata.tables)


def test_upgrade_and_downgrade_are_create_all_and_drop_all_against_base_metadata() -> None:
    """Pins the deliberate "single source of truth" choice this migration's
    docstring explains, so a future edit that silently reintroduces a second,
    hand-transcribed schema copy is a visible diff here."""
    import ast
    from pathlib import Path

    source = (
        Path(__file__).resolve().parents[2] / "alembic" / "versions" / "0001_initial.py"
    ).read_text(encoding="utf-8")
    tree = ast.parse(source)
    calls = {
        node.func.attr
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
    }
    assert "create_all" in calls
    assert "drop_all" in calls
