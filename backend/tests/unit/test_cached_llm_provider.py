"""`CachedProvider` (docs/10-roadmap.md M0: "`cached` LLM adapter replays a
recorded response" — the M0 verification checklist's exact wording)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from openspec.application.ports.llm import LlmMessage, LlmRequest
from openspec.domain.errors import DomainAbstention
from openspec.infrastructure.llm.cached import CachedProvider

_REQUEST = LlmRequest(
    stage="EXT",
    prompt_version="ext_v1",
    model="claude-sonnet-5",
    system="Extract the value.",
    messages=(LlmMessage(role="user", content="1/2 BRS BALL VLV 600WOG"),),
)


def test_replays_a_recorded_response_by_request_hash(tmp_path: Path) -> None:
    recording = {
        "content": "600 WOG",
        "model": "claude-sonnet-5",
        "tokens_in": 42,
        "tokens_out": 3,
        "cached_tokens": 0,
        "cost_usd": 0.001,
    }
    (tmp_path / f"{_REQUEST.request_hash}.json").write_text(json.dumps(recording))

    provider = CachedProvider(cache_dir=tmp_path)
    response = provider.complete(_REQUEST)

    assert response.content == "600 WOG"
    assert response.tokens_in == 42
    assert response.outcome == "success"


def test_missing_recording_raises_domain_abstention_not_a_fabricated_response(
    tmp_path: Path,
) -> None:
    provider = CachedProvider(cache_dir=tmp_path)
    with pytest.raises(DomainAbstention) as exc_info:
        provider.complete(_REQUEST)
    assert exc_info.value.reason_code == "SYSTEM_ERROR"


def test_replay_is_deterministic_across_repeated_calls(tmp_path: Path) -> None:
    recording = {"content": "x", "model": "m", "tokens_in": 1, "tokens_out": 1}
    (tmp_path / f"{_REQUEST.request_hash}.json").write_text(json.dumps(recording))
    provider = CachedProvider(cache_dir=tmp_path)

    first = provider.complete(_REQUEST)
    second = provider.complete(_REQUEST)

    assert first == second


def test_different_requests_hash_to_different_recordings(tmp_path: Path) -> None:
    other = LlmRequest(
        stage="EXT",
        prompt_version="ext_v1",
        model="claude-sonnet-5",
        system="Extract the value.",
        messages=(LlmMessage(role="user", content="a different description"),),
    )
    assert _REQUEST.request_hash != other.request_hash


def test_real_shipped_cache_dir_is_empty(tmp_path: Path) -> None:
    """docs/16-unilog-alignment.md's reference-data discipline, applied to LLM
    output: no pipeline stage calls this port yet in M0, so nothing real
    exists to record — inventing a recording would be fabrication."""
    from openspec.infrastructure.llm.cached import DEFAULT_CACHE_DIR

    json_files = list(DEFAULT_CACHE_DIR.glob("*.json"))
    assert json_files == []
