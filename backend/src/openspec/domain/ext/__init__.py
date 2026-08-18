"""`EXT` — grounded extraction (M3, `docs/10-roadmap.md` M3). Pure domain logic only:
span-containment enforcement (INV-3) and candidate construction from already-loaded
source material. No I/O, no LLM calls — those live in `application/usecases/
extract_attribute.py`, which orchestrates this package's pure functions with the
`LLMProvider` port.
"""

from __future__ import annotations
