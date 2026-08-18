"""Integration tests proving the Postgres `CHECK` constraints in
`infrastructure/db/models.py` actually reject invariant violations
(docs/05-backend.md §9: "test the constraints, not just the code" —
docs/10-roadmap.md M0's verification checklist: "Integration test proves the
DB rejects an `ACCEPTED` Tier-0 row").

**Skipped, not faked, when no Postgres is reachable.** This sandbox has no
Docker/local Postgres (docs/15-backend-implementation-status.md §3, unchanged
by M0) — these tests attempt a real connection first and skip with an
explicit reason if one isn't available, rather than mocking a database and
calling that "integration coverage". Point `OPENSPEC_TEST_DATABASE_URL` (or
`OPENSPEC_DATABASE_URL`) at a real Postgres 16 instance (e.g. `docker compose
up -d postgres` from `backend/`) to actually run them.
"""

from __future__ import annotations

import os
import uuid
from collections.abc import Generator

import pytest
import sqlalchemy as sa
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError, OperationalError

from openspec.infrastructure.db.models import (
    AttributeDefinitionRow,
    AttributeValueRow,
    Base,
    CatalogRecordRow,
    TaxonomyClassRow,
)

_TEST_DATABASE_URL = os.environ.get("OPENSPEC_TEST_DATABASE_URL") or os.environ.get(
    "OPENSPEC_DATABASE_URL", "postgresql+psycopg://openspec:openspec@localhost:5432/openspec"
)


def _reachable_engine() -> Engine | None:
    engine = sa.create_engine(_TEST_DATABASE_URL, connect_args={"connect_timeout": 2})
    try:
        with engine.connect():
            return engine
    except OperationalError:
        return None


@pytest.fixture(scope="module")
def pg_engine() -> Generator[Engine, None, None]:
    engine = _reachable_engine()
    if engine is None:
        pytest.skip(
            f"No reachable Postgres at {_TEST_DATABASE_URL} — no Docker/Postgres in this "
            "environment (docs/15-backend-implementation-status.md §3). This is an honest "
            "environment limitation, not a passing test: run `docker compose up -d postgres` "
            "from backend/ and re-run to actually exercise these constraints."
        )
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)
    engine.dispose()


def _seed_minimal_fixture(engine: Engine, *, risk_tier: int) -> tuple[uuid.UUID, uuid.UUID]:
    """A Tier-0-or-not attribute definition on a fresh taxonomy class + a
    fresh catalog record — the minimum FK graph `attribute_value` needs."""
    tenant_id = uuid.uuid4()
    with engine.begin() as conn:
        class_id = uuid.uuid4()
        conn.execute(
            sa.insert(TaxonomyClassRow).values(
                id=class_id, code=f"TEST_{uuid.uuid4().hex[:8]}", name="Test", schema_version="1"
            )
        )
        attr_id = uuid.uuid4()
        conn.execute(
            sa.insert(AttributeDefinitionRow).values(
                id=attr_id,
                class_id=class_id,
                code="test_attr",
                name="Test Attr",
                datatype="string",
                risk_tier=risk_tier,
                schema_version="1",
            )
        )
        record_id = uuid.uuid4()
        conn.execute(
            sa.insert(CatalogRecordRow).values(
                id=record_id,
                tenant_id=tenant_id,
                mpn_raw="X",
                mpn_canonical="X",
                description_raw="test fixture row",
            )
        )
    return attr_id, record_id


def test_db_rejects_an_accepted_tier0_row(pg_engine: Engine) -> None:
    """INV-9 as a database constraint (docs/04-data-model.md §3.4): it must be
    physically impossible to insert `status='ACCEPTED'` with `risk_tier=0`,
    even through a direct SQL statement bypassing all application code."""
    attr_id, record_id = _seed_minimal_fixture(pg_engine, risk_tier=0)

    with pytest.raises(IntegrityError, match="ck_attribute_value_inv9_tier0_never_accepted"):
        with pg_engine.begin() as conn:
            conn.execute(
                sa.insert(AttributeValueRow).values(
                    id=uuid.uuid4(),
                    tenant_id=uuid.uuid4(),
                    record_id=record_id,
                    attribute_definition_id=attr_id,
                    status="ACCEPTED",
                    value_raw="600 WOG",
                    provenance_kind="EXTRACTED",
                    risk_tier=0,
                    schema_version="1",
                    created_by_actor="system",
                )
            )


def test_db_accepts_an_accepted_tier1_row(pg_engine: Engine) -> None:
    """The negative-space check: the constraint is scoped to tier 0 only, not
    accidentally blocking every ACCEPTED row."""
    attr_id, record_id = _seed_minimal_fixture(pg_engine, risk_tier=1)

    with pg_engine.begin() as conn:
        conn.execute(
            sa.insert(AttributeValueRow).values(
                id=uuid.uuid4(),
                tenant_id=uuid.uuid4(),
                record_id=record_id,
                attribute_definition_id=attr_id,
                status="ACCEPTED",
                value_raw="Bronze",
                provenance_kind="EXTRACTED",
                risk_tier=1,
                schema_version="1",
                created_by_actor="system",
            )
        )


def test_db_rejects_unknown_status_without_a_reason_code(pg_engine: Engine) -> None:
    """INV-4: `status='UNKNOWN'` requires `unknown_reason IS NOT NULL`."""
    attr_id, record_id = _seed_minimal_fixture(pg_engine, risk_tier=1)

    with pytest.raises(IntegrityError, match="ck_attribute_value_inv4_unknown_reason"):
        with pg_engine.begin() as conn:
            conn.execute(
                sa.insert(AttributeValueRow).values(
                    id=uuid.uuid4(),
                    tenant_id=uuid.uuid4(),
                    record_id=record_id,
                    attribute_definition_id=attr_id,
                    status="UNKNOWN",
                    unknown_reason=None,
                    provenance_kind="EXTRACTED",
                    risk_tier=1,
                    schema_version="1",
                    created_by_actor="system",
                )
            )


def test_db_rejects_accepted_without_verification(pg_engine: Engine) -> None:
    """INV-2: `status='ACCEPTED'` requires `verification_id IS NOT NULL`."""
    attr_id, record_id = _seed_minimal_fixture(pg_engine, risk_tier=1)

    with pytest.raises(IntegrityError, match="ck_attribute_value_inv2_verified"):
        with pg_engine.begin() as conn:
            conn.execute(
                sa.insert(AttributeValueRow).values(
                    id=uuid.uuid4(),
                    tenant_id=uuid.uuid4(),
                    record_id=record_id,
                    attribute_definition_id=attr_id,
                    status="ACCEPTED",
                    value_raw="Bronze",
                    verification_id=None,
                    provenance_kind="EXTRACTED",
                    risk_tier=1,
                    schema_version="1",
                    created_by_actor="system",
                )
            )
