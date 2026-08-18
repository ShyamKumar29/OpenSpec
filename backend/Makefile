.PHONY: install test lint typecheck format check run eval up down

VENV := .venv/Scripts

install:
	python -m venv .venv
	$(VENV)/python -m pip install -e ".[dev]"

test:
	$(VENV)/python -m pytest -q

lint:
	$(VENV)/python -m ruff check src tests

format:
	$(VENV)/python -m ruff format src tests

typecheck:
	$(VENV)/python -m mypy src

check: lint typecheck test

run:
	$(VENV)/python -m uvicorn openspec.api.main:app --reload

# EVL (M1, docs/10-roadmap.md) — real predictions from the existing UH4
# pipeline, scored against the gold set if one is present; honestly reports
# GOLD_SET_UNAVAILABLE otherwise (see resources/reference/unihack/gold/README.md).
eval:
	$(VENV)/python scripts/run_eval.py

# Starts Postgres only today — see docker-compose.yml's header comment and
# docs/15-backend-implementation-status.md for why `api`/`worker` aren't wired yet.
up:
	docker compose up -d

down:
	docker compose down
