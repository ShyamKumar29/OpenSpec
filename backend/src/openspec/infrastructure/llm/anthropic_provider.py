"""`AnthropicProvider` — the `live` mode adapter (docs/03-ai-pipeline.md §10).
Vendor SDK (`anthropic`) named only here, per CLAUDE.md's "Vendors... are
named only in `infrastructure/`".

**Not exercised against the live Anthropic API in this environment** — no API
key is configured (`docs/15-backend-implementation-status.md` §6: "no LLM API
key"), and no pipeline stage calls `LLMProvider` yet in M0 (§4's "not built
yet" table). Correctness of the request/response mapping is proven instead
against a mocked `anthropic.Anthropic` client (`tests/unit/
test_anthropic_provider.py`) — the same discipline `S3BlobStore` already
applies for the credential it doesn't have either.
"""

from __future__ import annotations

import anthropic

from openspec.application.ports.llm import LlmRequest, LlmResponse
from openspec.domain.errors import TransientError


class AnthropicProvider:
    def __init__(self, *, api_key: str, client: anthropic.Anthropic | None = None) -> None:
        self._client = client if client is not None else anthropic.Anthropic(api_key=api_key)

    def complete(self, request: LlmRequest) -> LlmResponse:
        try:
            response = self._client.messages.create(
                model=request.model,
                system=request.system,
                max_tokens=request.max_tokens,
                messages=[{"role": m.role, "content": m.content} for m in request.messages],
            )
        except (
            anthropic.RateLimitError,
            anthropic.APIConnectionError,
            anthropic.APITimeoutError,
        ) as exc:
            # docs/03-ai-pipeline.md §9: "LLM 429/503 -> backoff + retry x3 -> ...
            # -> never emit a value without verification." Retry/backoff policy
            # itself belongs to the stage calling this port, not the adapter —
            # this adapter's job is only to classify the failure correctly.
            detail = f"Anthropic API call failed (stage={request.stage}): {exc}"
            raise TransientError(detail) from exc

        text_blocks = [block.text for block in response.content if block.type == "text"]
        return LlmResponse(
            content="".join(text_blocks),
            model=response.model,
            tokens_in=response.usage.input_tokens,
            tokens_out=response.usage.output_tokens,
            cached_tokens=getattr(response.usage, "cache_read_input_tokens", 0) or 0,
            cost_usd=0.0,  # cost accounting: docs/04-data-model.md llm_call.cost_usd is
            # computed from (model, tokens_in, tokens_out) by the ledger-writing use
            # case, not hardcoded per-model pricing in the adapter (M0 scaffolds the
            # ledger table + this response shape; the pricing table itself is a later
            # milestone's config, per CLAUDE.md "thresholds are configuration").
            outcome="success",
        )
