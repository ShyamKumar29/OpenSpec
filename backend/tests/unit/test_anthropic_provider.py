"""`AnthropicProvider` (docs/10-roadmap.md M0: "`LLMProvider` port with real...
adapter") — unit tested against a mocked `anthropic.Anthropic` client, per the
adapter module's own docstring: no live API key in this environment."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import httpx
import pytest
from anthropic import APIConnectionError

from openspec.application.ports.llm import LlmMessage, LlmRequest
from openspec.domain.errors import TransientError
from openspec.infrastructure.llm.anthropic_provider import AnthropicProvider

_REQUEST = LlmRequest(
    stage="EXT",
    prompt_version="ext_v1",
    model="claude-sonnet-5",
    system="Extract the value.",
    messages=(LlmMessage(role="user", content="1/2 BRS BALL VLV 600WOG"),),
)


def _fake_response(text: str = "600 WOG") -> SimpleNamespace:
    return SimpleNamespace(
        content=[SimpleNamespace(type="text", text=text)],
        model="claude-sonnet-5",
        usage=SimpleNamespace(input_tokens=42, output_tokens=3, cache_read_input_tokens=0),
    )


def test_complete_maps_a_successful_response() -> None:
    client = MagicMock()
    client.messages.create.return_value = _fake_response("600 WOG")
    provider = AnthropicProvider(api_key="unused", client=client)

    response = provider.complete(_REQUEST)

    assert response.content == "600 WOG"
    assert response.tokens_in == 42
    assert response.tokens_out == 3
    assert response.outcome == "success"


def test_complete_passes_model_system_and_messages_through() -> None:
    client = MagicMock()
    client.messages.create.return_value = _fake_response()
    provider = AnthropicProvider(api_key="unused", client=client)

    provider.complete(_REQUEST)

    call_kwargs = client.messages.create.call_args.kwargs
    assert call_kwargs["model"] == "claude-sonnet-5"
    assert call_kwargs["system"] == "Extract the value."
    assert call_kwargs["messages"] == [{"role": "user", "content": "1/2 BRS BALL VLV 600WOG"}]


def test_connection_error_becomes_transient_error_not_swallowed() -> None:
    client = MagicMock()
    client.messages.create.side_effect = APIConnectionError(
        request=httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    )
    provider = AnthropicProvider(api_key="unused", client=client)

    with pytest.raises(TransientError):
        provider.complete(_REQUEST)


def test_multiple_text_blocks_are_concatenated() -> None:
    client = MagicMock()
    client.messages.create.return_value = SimpleNamespace(
        content=[
            SimpleNamespace(type="text", text="600 "),
            SimpleNamespace(type="text", text="WOG"),
        ],
        model="claude-sonnet-5",
        usage=SimpleNamespace(input_tokens=1, output_tokens=1, cache_read_input_tokens=0),
    )
    provider = AnthropicProvider(api_key="unused", client=client)

    assert provider.complete(_REQUEST).content == "600 WOG"
