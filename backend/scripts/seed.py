"""CLI entrypoint for `infrastructure/db/seed.py` (docs/10-roadmap.md M0,
`make seed`). Idempotent — safe to run on every deploy and every developer
onboarding, per docs/04-data-model.md §7.

    cd backend
    .venv/Scripts/python scripts/seed.py

Requires `OPENSPEC_DATABASE_URL` (or a populated `.env`) pointing at a
reachable Postgres — this script does not run against the in-memory demo
repository, which has nothing to seed into (docs/15-backend-implementation-
status.md §3: no Docker/Postgres in this sandbox, so this has not been run
here; `tests/unit/test_seed.py` and `tests/integration/
test_seed_idempotency.py` cover it instead).
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import sqlalchemy as sa  # noqa: E402

from openspec.config.settings import get_settings  # noqa: E402
from openspec.infrastructure.db.seed import seed_taxonomy  # noqa: E402


def main() -> None:
    settings = get_settings()
    if not settings.database_url:
        raise SystemExit(
            "OPENSPEC_DATABASE_URL is not set — see backend/.env.example. "
            "The seeder targets Postgres, not the in-memory demo repository."
        )
    engine = sa.create_engine(settings.database_url)
    with engine.begin() as conn:
        report = seed_taxonomy(conn)
    print(f"Seeded {report.classes_seeded} class(es), {report.attributes_seeded} attribute(s).")


if __name__ == "__main__":
    main()
