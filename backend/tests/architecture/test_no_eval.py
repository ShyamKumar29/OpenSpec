"""INV-6 / docs/05-backend.md §6: the rules DSL is a restricted interpreter. A rules
engine that executes arbitrary strings from a config file is remote code execution
wearing a bow tie — so `eval`/`exec` are banned everywhere in the codebase, not just
in `domain/val/`, by an architecture test rather than a review comment.
"""

from __future__ import annotations

import ast
from pathlib import Path

SRC_ROOT = Path(__file__).resolve().parents[2] / "src" / "openspec"
BANNED_CALLS = {"eval", "exec"}


def test_no_eval_or_exec_anywhere_in_src() -> None:
    violations: list[str] = []
    for path in sorted(SRC_ROOT.rglob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Name)
                and node.func.id in BANNED_CALLS
            ):
                loc = f"{path.relative_to(SRC_ROOT)}:{node.lineno}"
                violations.append(f"{loc}: {node.func.id}(...)")
    assert not violations, f"eval()/exec() found: {violations}"
