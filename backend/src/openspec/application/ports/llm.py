"""`LLMProvider` — the port every LLM-touching stage (`CLS` residual, `EXT`,
`VER`) will call through (docs/10-roadmap.md M0, docs/13-implementation-
blueprint.md step 6). No pipeline stage is wired to this port yet in M0 — see
`docs/15-backend-implementation-status.md` §4's "not built yet" table — this
is the port + its three adapters (`real` / `cached` / `offline`,
docs/03-ai-pipeline.md §10), landed ahead of the stages that will use them, the
same "guards before the guarded" ordering `05-backend.md`'s recommendation 3
applies to `CachedProvider` specifically.

`request_hash` is what makes `cached` mode a genuine replay rather than a
mock: it is a deterministic digest of everything that would change the
model's answer (stage, prompt version, model id, and the message content
itself), computed here — in the port, not per-adapter — so every adapter
agrees on the same key `llm_call.request_hash` (docs/04-data-model.md §3.5)
is recorded and looked up by.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Literal, Protocol


@dataclass(frozen=True, slots=True)
class LlmMessage:
    role: Literal["user", "assistant"]
    content: str


@dataclass(frozen=True, slots=True)
class LlmRequest:
    stage: str  # module code, e.g. "EXT", "VER", "CLS" (docs/api.md llm_call.stage)
    prompt_version: str  # e.g. "ext_v1" — resources/prompts/<prompt_version>.md
    model: str
    system: str
    messages: tuple[LlmMessage, ...]
    max_tokens: int = 1024

    @property
    def request_hash(self) -> str:
        """Deterministic digest — same inputs, same hash, every process, every
        run (INV-10). Never includes a clock or random salt (INV-6's spirit,
        applied one layer up: this port is `application/`, not `domain/`, but
        the same determinism discipline applies to anything `cached` mode
        keys on)."""
        payload = "\x1f".join(
            (
                self.stage,
                self.prompt_version,
                self.model,
                self.system,
                *(f"{m.role}:{m.content}" for m in self.messages),
            )
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()


@dataclass(frozen=True, slots=True)
class LlmResponse:
    content: str
    model: str
    tokens_in: int
    tokens_out: int
    cached_tokens: int = 0
    cost_usd: float = 0.0
    outcome: str = "success"  # llm_call.outcome (docs/04-data-model.md §3.5)


class LLMProvider(Protocol):
    def complete(self, request: LlmRequest) -> LlmResponse:
        """Raises `openspec.domain.errors.TransientError` on a retryable
        failure (rate limit, timeout) and `openspec.domain.errors.
        DomainAbstention("SYSTEM_ERROR", ...)` when the mode itself makes
        completion impossible (offline mode; cached mode with no recording
        for this `request_hash`) — never returns a fabricated response for
        either case (CLAUDE.md: "contract violation -> crash loudly" /
        "domain abstention -> not a failure", applied per docs/03-ai-pipeline.md
        §9's fallback table: "never emit a value without verification")."""
        ...
