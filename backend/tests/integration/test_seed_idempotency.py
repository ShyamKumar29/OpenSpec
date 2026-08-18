"""Real idempotency proof for `infrastructure/db/seed.py`
(docs/10-roadmap.md M0 verification checklist: "Seeder is idempotent (run
twice, identical state)"). Skipped, not faked, when no Postgres is reachable
— see `tests/integration/test_constraints.py`'s module docstring for the
same pattern and the same reason.
"""

from __future__ import annotations

import os
from collections.abc import Generator

import pytest
import sqlalchemy as sa
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError

from openspec.infrastructure.db.models import AttributeDefinitionRow, Base, TaxonomyClassRow
from openspec.infrastructure.db.seed import DEFAULT_TAXONOMY_PATH, seed_taxonomy

_TEST_DATABASE_URL = os.environ.get("OPENSPEC_TEST_DATABASE_URL") or os.environ.get(
    "OPENSPEC_DATABASE_URL", "postgresql+psycopg://openspec:openspec@localhost:5432/openspec"
)


@pytest.fixture
def pg_engine() -> Generator[Engine, None, None]:
    engine = sa.create_engine(_TEST_DATABASE_URL, connect_args={"connect_timeout": 2})
    try:
        with engine.connect():
            pass
    except OperationalError:
        pytest.skip(
            f"No reachable Postgres at {_TEST_DATABASE_URL} — see "
            "docs/15-backend-implementation-status.md §3. Run "
            "`docker compose up -d postgres` from backend/ to actually exercise this."
        )
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)
    engine.dispose()


def test_running_the_seeder_twice_leaves_identical_state(pg_engine: Engine) -> None:
    with pg_engine.begin() as conn:
        report_1 = seed_taxonomy(conn, path=DEFAULT_TAXONOMY_PATH)
    with pg_engine.connect() as conn:
        classes_after_first = conn.execute(
            sa.select(sa.func.count()).select_from(TaxonomyClassRow)
        ).scalar_one()
        attrs_after_first = conn.execute(
            sa.select(sa.func.count()).select_from(AttributeDefinitionRow)
        ).scalar_one()
        ids_after_first = set(conn.execute(sa.select(TaxonomyClassRow.id)).scalars())

    with pg_engine.begin() as conn:
        report_2 = seed_taxonomy(conn, path=DEFAULT_TAXONOMY_PATH)
    with pg_engine.connect() as conn:
        classes_after_second = conn.execute(
            sa.select(sa.func.count()).select_from(TaxonomyClassRow)
        ).scalar_one()
        attrs_after_second = conn.execute(
            sa.select(sa.func.count()).select_from(AttributeDefinitionRow)
        ).scalar_one()
        ids_after_second = set(conn.execute(sa.select(TaxonomyClassRow.id)).scalars())

    assert report_1 == report_2
    assert classes_after_first == classes_after_second
    assert attrs_after_first == attrs_after_second
    # Same primary keys, not new rows with the same natural key — proves the
    # second run matched and updated the existing rows via ON CONFLICT rather
    # than inserting duplicates that a unique constraint happened to allow.
    assert ids_after_first == ids_after_second
