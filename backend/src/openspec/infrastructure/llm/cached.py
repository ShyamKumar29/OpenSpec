"""`CachedProvider` — `docs/03-ai-pipeline.md` §10's `cached` mode: "replays
recorded LLM responses keyed by prompt hash... deterministic, instant, zero
network." This is the demo safety net (`docs/05-backend.md` §10
recommendation 3: "implement `CachedProvider` at the same time as the real
provider, not later").

A recording is one JSON file per `request_hash` (`LlmRequest.request_hash`,
computed identically regardless of which adapter runs) under `cache_dir` —
`{"content": ..., "model": ..., "tokens_in": ..., "tokens_out": ...,
"cached_tokens": ..., "cost_usd": ...}`. Recordings are produced by a real
`AnthropicProvider` run and committed to `resources/llm-cache/` (ships empty
in this milestone — no pipeline stage calls this port yet, so there is
nothing real to record from; see that directory's README). A missing
recording is a loud failure, never a fabricated response — replaying an
LLM's *absence* by inventing an answer would be exactly the kind of
unsourced assertion CLAUDE.md exists to prevent.
"""

from __future__ import annotations

import json
from pathlib import Path

from openspec.application.ports.llm import LlmRequest, LlmResponse
from openspec.domain.errors import DomainAbstention

_RESOURCES_ROOT = Path(__file__).resolve().parents[3] / "resources"
DEFAULT_CACHE_DIR = _RESOURCES_ROOT / "llm-cache"


class CachedProvider:
    def __init__(self, cache_dir: Path = DEFAULT_CACHE_DIR) -> None:
        self._cache_dir = cache_dir

    def complete(self, request: LlmRequest) -> LlmResponse:
        recording_path = self._cache_dir / f"{request.request_hash}.json"
        if not recording_path.exists():
            raise DomainAbstention(
                "SYSTEM_ERROR",
                f"cached mode: no recorded response for stage={request.stage} "
                f"prompt_version={request.prompt_version} "
                f"(request_hash={request.request_hash}, expected {recording_path})",
            )
        raw = json.loads(recording_path.read_text(encoding="utf-8"))
        return LlmResponse(
            content=raw["content"],
            model=raw["model"],
            tokens_in=raw["tokens_in"],
            tokens_out=raw["tokens_out"],
            cached_tokens=raw.get("cached_tokens", 0),
            cost_usd=raw.get("cost_usd", 0.0),
            outcome="success",
        )
