"""`OfflineProvider` — `docs/03-ai-pipeline.md` §10's `offline` mode: "rules +
validation + normalisation only; all LLM stages emit `Unknown(SYSTEM_ERROR)`".
Deliberately the simplest of the three adapters — it proves graceful
degradation (NFR-AVL-2) rather than doing anything itself, the same role
`Unknown(REFERENCE_DATA_UNAVAILABLE)` plays for `RES` when its reference
workbook is missing (`docs/16-unilog-alignment.md` UH2).
"""

from __future__ import annotations

from openspec.application.ports.llm import LlmRequest, LlmResponse
from openspec.domain.errors import DomainAbstention


class OfflineProvider:
    def complete(self, request: LlmRequest) -> LlmResponse:
        raise DomainAbstention(
            "SYSTEM_ERROR", f"offline mode: no LLM call is permitted (stage={request.stage})"
        )
