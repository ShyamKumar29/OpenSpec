"""Loads a versioned prompt file from `resources/prompts/<prompt_version>.md`
(CLAUDE.md Conventions: "Prompts: Versioned files in
`backend/resources/prompts/`. **Inline prompt strings fail review.**"). File
I/O, so this lives in `infrastructure/`, never `domain/`/`application/`
(INV-6) — a stage builds its request from the string this returns, never
from an f-string embedded in stage code.
"""

from __future__ import annotations

from pathlib import Path

_RESOURCES_ROOT = Path(__file__).resolve().parents[3] / "resources"
DEFAULT_PROMPTS_DIR = _RESOURCES_ROOT / "prompts"


def load_prompt(prompt_version: str, prompts_dir: Path = DEFAULT_PROMPTS_DIR) -> str:
    """`prompt_version` is the bare name (e.g. `"cls_v1"`), matching
    `LlmRequest.prompt_version` (`application/ports/llm.py`) — the same
    string is recorded on every `llm_call` row (docs/04-data-model.md §3.5,
    INV-10), so the file name and the reproducibility key are always the
    same value, never two things a caller could let drift apart."""
    return (prompts_dir / f"{prompt_version}.md").read_text(encoding="utf-8")
