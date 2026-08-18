"""`DescriptionFormulaReference` — the port `DSC` resolves against (UH5,
ADR-0013). `application/` depends on this `Protocol` only, never a concrete
adapter — `infrastructure/reference_data/description_formulas.py` is the
production-shaped implementation. A `None` return from `formula_for` means
"no formula configured for this field+class yet" — turned into
`DescriptionBlocked`, never a guessed formula
(`application/usecases/build_description.py`).
"""

from __future__ import annotations

from typing import Protocol

from openspec.domain.model.description import DescriptionFormula


class DescriptionFormulaReference(Protocol):
    def formula_for(self, *, field_code: str, class_code: str) -> DescriptionFormula | None: ...
