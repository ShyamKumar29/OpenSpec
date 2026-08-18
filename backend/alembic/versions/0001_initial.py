"""initial schema

docs/10-roadmap.md M0: "Postgres schema migration #1 including every INV
`CHECK` constraint." `upgrade()` creates every table in `Base.metadata`
(`infrastructure/db/models.py`) directly, rather than a hand-transcribed
sequence of `op.create_table(...)` calls, deliberately: `models.py` is
already the single reviewed, tested source of truth for this schema
(`tests/unit/test_db_schema.py` compiles it against the Postgres dialect),
and a second, independently-maintained copy of ~20 tables' worth of columns
and `CHECK` constraints in this file would be exactly the kind of drift risk
`docs/04-data-model.md`'s "the schema enforces the invariants" principle
warns against — two sources of truth for the same guarantee, one of which
would silently rot. `alembic revision --autogenerate` (the usual way to fill
this file in) needs a live database to diff against for change detection;
there is none in this environment (`docs/15-backend-implementation-status.md`
§3) and this is migration #1 (nothing to diff against — the target state
*is* the starting state), so autogenerate would not add anything beyond what
`create_all`/`drop_all` already expresses correctly.

**Not run against a live Postgres in this environment.** `tests/unit/
test_migration_0001.py` proves this migration's DDL is well-formed (compiles
against the Postgres dialect, includes every table and every named `CHECK`
constraint from `models.py`) without one, the same discipline
`test_db_schema.py` already established for `EvidenceRow` alone, generalised
here to the whole schema.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
from openspec.infrastructure.db.models import Base

revision: str = "0001"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind())
