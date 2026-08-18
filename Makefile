# Root Makefile (docs/07-devops.md §1's repo layout; CLAUDE.md's Commands
# table). Every target here delegates to the subproject that actually
# implements it — this file has no logic of its own, so there is exactly one
# place (`backend/Makefile`, `frontend/package.json`) each command is really
# defined, matching the "one source of truth" discipline the rest of this
# repo already applies to schemas and taxonomy.
#
# `eval` delegates to `backend/scripts/run_eval.py` (EVL, M1,
# docs/10-roadmap.md — landed this milestone). `demo`/`snapshot` remain
# honest stubs: the demo-snapshot tooling is a later milestone (M6) per
# docs/15-backend-implementation-status.md §4's "not built yet" table —
# these targets say so rather than silently doing nothing or pretending to
# run something that doesn't exist.
#
# Not run end-to-end in this environment: no `make`, no `docker` binary here
# (docs/15-backend-implementation-status.md §3's Postgres gap extends to the
# tooling itself in this sandbox) — verified by direct invocation of the
# underlying commands instead (`cd backend && .venv/Scripts/python -m ...`).

.PHONY: up down seed test eval demo snapshot install run

up:
	docker compose up -d

down:
	docker compose down

install:
	$(MAKE) -C backend install
	cd frontend && npm ci --legacy-peer-deps

# Idempotent (infrastructure/db/seed.py) — loads resources/taxonomy/classes.yaml
# into taxonomy_class/attribute_definition. Requires OPENSPEC_DATABASE_URL
# (backend/.env) pointing at a reachable Postgres; see backend/scripts/seed.py.
seed:
	cd backend && .venv/Scripts/python scripts/seed.py

# docs/09-testing.md: unit + architecture + integration, backend and frontend.
test:
	$(MAKE) -C backend check
	cd frontend && npm run typecheck && npm run lint && npm test

# Real predictions (existing UH4 pipeline) scored against the gold set if
# one is present; honestly reports GOLD_SET_UNAVAILABLE otherwise — see
# backend/resources/reference/unihack/gold/README.md. Writes
# backend/evaluation/reports/*.{md,json}.
eval:
	cd backend && .venv/Scripts/python scripts/run_eval.py

demo:
	@echo "make demo: demo-snapshot restore tooling is not built yet — it lands at M6"
	@echo "(docs/10-roadmap.md). Today's demo path is 'make up && make seed', memory"
	@echo "repository backend, per docs/15-backend-implementation-status.md."
	@exit 1

snapshot:
	@echo "make snapshot: demo-snapshot capture tooling is not built yet — see M6"
	@echo "in docs/10-roadmap.md."
	@exit 1

# Convenience, not part of CLAUDE.md's documented command table: run both
# dev servers. Two terminals in practice; listed here for completeness.
run:
	@echo "Run in two terminals:"
	@echo "  cd backend  && make run   # uvicorn :8000, repository_backend=memory"
	@echo "  cd frontend && npm run dev"
