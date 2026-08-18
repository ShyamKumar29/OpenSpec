"""Alembic environment (docs/10-roadmap.md M0: "Postgres schema migration #1
including every INV `CHECK` constraint", docs/13-implementation-blueprint.md
step 4). `target_metadata` is `infrastructure/db/models.py`'s `Base.metadata`
directly — the same object `tests/unit/test_db_schema.py` already compiles
against the Postgres dialect — so there is exactly one place the schema is
defined, never a second hand-transcribed copy for migrations to drift from.

**Not run against a live database in this environment** (no Docker/Postgres —
`docs/15-backend-implementation-status.md` §3, unchanged by M0). `alembic
upgrade head` needs `OPENSPEC_DATABASE_URL` (or `Settings.database_url`)
pointing at a reachable Postgres; the offline/online branches below are the
standard Alembic template, unmodified beyond wiring the URL and metadata.
"""

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context
from openspec.config.settings import get_settings
from openspec.infrastructure.db.models import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _database_url() -> str:
    settings = get_settings()
    if settings.database_url:
        return settings.database_url
    # Falls back to alembic.ini's placeholder only if neither
    # OPENSPEC_DATABASE_URL nor .env supplies one — `run_migrations_online`
    # will then fail loudly on connect, per CLAUDE.md's "contract violation ->
    # crash loudly" rather than silently targeting the wrong database.
    configured = config.get_main_option("sqlalchemy.url")
    if configured is None:
        raise RuntimeError("No database URL configured (OPENSPEC_DATABASE_URL or alembic.ini)")
    return configured


def run_migrations_offline() -> None:
    """Emits SQL to stdout without a live connection — usable in this
    environment to inspect what `upgrade()` would run."""
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    section = config.get_section(config.config_ini_section, {})
    section["sqlalchemy.url"] = _database_url()
    connectable = engine_from_config(section, prefix="sqlalchemy.", poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
