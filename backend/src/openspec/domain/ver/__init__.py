"""`VER` — pure, deterministic entailment checks (UH4, docs/16-unilog-alignment.md
UH4). INV-2 requires an independent verification pass before anything reaches
`ACCEPTED`; the checks in `entailment.py` are the deterministic pre-checks the
brief calls for ("LOV-membership check as the deterministic pre-check... a
strictly easier deterministic check than PDF-span entailment"). No I/O, no
LLM — this package is pure by construction, same discipline as `domain/val`
and `domain/nrm`.
"""
