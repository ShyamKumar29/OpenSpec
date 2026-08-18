"""`OfflineProvider` (docs/03-ai-pipeline.md §10: "offline: all LLM stages
emit `Unknown(SYSTEM_ERROR)`")."""

from __future__ import annotations

import pytest

from openspec.application.ports.llm import LlmMessage, LlmRequest
from openspec.domain.errors import DomainAbstention
from openspec.infrastructure.llm.offline import OfflineProvider


def test_every_request_raises_domain_abstention_system_error() -> None:
    provider = OfflineProvider()
    request = LlmRequest(
        stage="VER",
        prompt_version="ver_v1",
        model="claude-sonnet-5",
        system="Verify.",
        messages=(LlmMessage(role="user", content="600 WOG"),),
    )
    with pytest.raises(DomainAbstention) as exc_info:
        provider.complete(request)
    assert exc_info.value.reason_code == "SYSTEM_ERROR"


def test_no_network_or_filesystem_access_is_attempted() -> None:
    """OfflineProvider must not even try to reach a cache file or network —
    it is the "graceful degradation" mode, not a degraded cached mode."""
    import socket

    original_socket = socket.socket

    def _fail_if_called(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("OfflineProvider must never open a socket")

    socket.socket = _fail_if_called  # type: ignore[assignment]
    try:
        provider = OfflineProvider()
        request = LlmRequest(
            stage="CLS", prompt_version="cls_v1", model="m", system="s", messages=()
        )
        with pytest.raises(DomainAbstention):
            provider.complete(request)
    finally:
        socket.socket = original_socket
