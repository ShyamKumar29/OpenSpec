"""`infrastructure/prompt_loader.py`."""

from __future__ import annotations

import pytest

from openspec.infrastructure.prompt_loader import DEFAULT_PROMPTS_DIR, load_prompt


def test_loads_real_cls_v1_prompt() -> None:
    text = load_prompt("cls_v1", DEFAULT_PROMPTS_DIR)
    assert "{class_list}" in text
    assert "{mpn}" in text
    assert "{description}" in text
    assert "NONE" in text


def test_missing_prompt_raises() -> None:
    with pytest.raises(FileNotFoundError):
        load_prompt("does_not_exist_v99", DEFAULT_PROMPTS_DIR)
