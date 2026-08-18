"""Reference-data loading layer (UH0, `docs/16-unilog-alignment.md`).

Turns the supplied UniHack reference files under `resources/reference/unihack/` into
validated, typed, in-memory structures the application/domain layers can consume
without knowing CSV/filesystem details exist (`docs/05-backend.md` §1's port pattern,
applied to reference data the same way `taxonomy_loader.py` already applies it to
`resources/taxonomy/classes.yaml`). File I/O lives here, in `infrastructure/`, never
in `domain/` — reading a file is an effect (INV-6).

Only two datasets are actually loadable in this environment today — see
`resources/reference/unihack/README.md` and `docs/15-backend-implementation-status.md`
§7 for why. `missing_datasets.py` registers the rest so later milestones that need
them fail loudly and specifically, instead of silently finding nothing.
"""

from __future__ import annotations
