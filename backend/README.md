# OpenSpec backend

Read `../CLAUDE.md` and `../docs/05-backend.md` first — this README is the "how to
run it" complement to those, not a restatement.

## Status

A foundation slice, not a complete backend. See
[`../docs/15-backend-implementation-status.md`](../docs/15-backend-implementation-status.md)
for exactly what exists, what's designed-but-unwired, and what's next.

## Quick start (today)

```bash
make install   # creates .venv, installs the package + dev deps
make check     # ruff + mypy --strict + pytest
make run       # uvicorn on :8000, backed by the in-memory demo repository
```

Then: `curl localhost:8000/health`, `curl localhost:8000/api/v1/records`.

No Docker or Postgres is required for any of the above — `repository_backend=memory`
(the default) serves a small, deterministic demo dataset built in-process from
`resources/taxonomy/classes.yaml`.

## Postgres (designed, not yet wired)

```bash
make up        # docker compose up -d — starts Postgres 16 only
```

`infrastructure/db/models.py` is the full Postgres-targeted schema
(docs/04-data-model.md §3, INV `CHECK` constraints included) and its DDL has been
verified to compile against the Postgres dialect. There is no repository
implementation reading/writing it yet, and no Alembic migration wired to it —
`OPENSPEC_REPOSITORY_BACKEND=postgres` raises at startup rather than silently
degrading. See the status doc for the concrete next step.

## Layout

Mirrors `docs/05-backend.md` §1 exactly — module codes are folder names
(`domain/val/`, `domain/nrm/`, …) so a requirement ID maps to a directory without
translation.
