"""The import-graph test (docs/05-backend.md §2). Walks every module's AST and
asserts the dependency rule mechanically — a violation fails the build, not a review
comment. This is deliberately independent of any runtime import (no `importlib`):
a layering bug should fail even if the violating module is never actually executed
by another test.
"""

from __future__ import annotations

import ast
from pathlib import Path

SRC_ROOT = Path(__file__).resolve().parents[2] / "src" / "openspec"

STDLIB_ALLOWED_ROOTS = {
    # Every module actually used across domain/ today. Deliberately a small,
    # explicit list rather than `sys.stdlib_module_names` so a new stdlib import
    # (e.g. `os`, `random`) is a visible diff here, not a silent pass.
    "__future__",
    "dataclasses",
    "enum",
    "typing",
    "collections",
    "abc",
    # UH2 (docs/16-unilog-alignment.md G3) — domain/nrm/manufacturer_brand.py.
    # Both are pure, deterministic, no I/O/clock/randomness — INV-6-safe, and
    # both are also explicitly allowed inside domain/val or domain/nrm below
    # (they are not in INV6_BANNED_ANYWHERE_IN_VAL_NRM).
    "re",
    "difflib",
    # UH4 (docs/16-unilog-alignment.md UH4) — domain/nrm/fractions.py. Exact rational
    # arithmetic (CLAUDE.md: "Parse to exact Fraction, never float"), deterministic,
    # no I/O/clock/randomness — INV-6-safe, not in INV6_BANNED_ANYWHERE_IN_VAL_NRM below.
    "fractions",
    # M3 (docs/10-roadmap.md M3 §5) — domain/ext/llm_proposal.py,
    # domain/ver/llm_verdict.py. `json.loads` parses an already-received LLM
    # response string into typed dataclasses — pure, deterministic, no I/O/clock/
    # randomness of its own (the network call that produced the string happened in
    # infrastructure/application, not here) — INV-6-safe.
    "json",
}
DOMAIN_ALLOWED_THIRD_PARTY = {"pydantic"}

# INV-6: domain/val and domain/nrm (once they exist) may additionally not import
# these, even though they're otherwise stdlib-legal elsewhere in domain/.
INV6_BANNED_ANYWHERE_IN_VAL_NRM = {"time", "datetime", "random", "os", "requests", "httpx"}


def _iter_py_files(*roots: str) -> list[Path]:
    files: list[Path] = []
    for root in roots:
        base = SRC_ROOT / root
        if base.exists():
            files.extend(sorted(base.rglob("*.py")))
    return files


def _top_level_imports(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                names.add(alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom):
            if node.level and node.level > 0:
                continue  # relative import within the same package tree
            if node.module:
                names.add(node.module.split(".")[0])
    return names


def test_domain_imports_nothing_outside_stdlib_and_pydantic() -> None:
    violations: dict[str, set[str]] = {}
    for path in _iter_py_files("domain"):
        imports = _top_level_imports(path)
        illegal = {
            name
            for name in imports
            if name != "openspec"
            and name not in STDLIB_ALLOWED_ROOTS
            and name not in DOMAIN_ALLOWED_THIRD_PARTY
        }
        if illegal:
            violations[str(path.relative_to(SRC_ROOT))] = illegal
    assert not violations, f"domain/ imported outside stdlib+pydantic: {violations}"


def test_domain_val_and_nrm_are_INV6_pure() -> None:
    violations: dict[str, set[str]] = {}
    for path in _iter_py_files("domain/val", "domain/nrm"):
        imports = _top_level_imports(path)
        illegal = imports & INV6_BANNED_ANYWHERE_IN_VAL_NRM
        if illegal:
            violations[str(path.relative_to(SRC_ROOT))] = illegal
    msg = f"domain/val or domain/nrm imported a clock/RNG/network name: {violations}"
    assert not violations, msg


def test_application_never_imports_infrastructure() -> None:
    violations: list[str] = []
    for path in _iter_py_files("application"):
        for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            stripped = line.strip()
            if stripped.startswith("from openspec.infrastructure") or stripped.startswith(
                "import openspec.infrastructure"
            ):
                violations.append(f"{path.relative_to(SRC_ROOT)}:{line_no}: {stripped}")
    assert not violations, f"application/ imported infrastructure/: {violations}"


def test_application_never_imports_api() -> None:
    violations: list[str] = []
    for path in _iter_py_files("application"):
        for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            stripped = line.strip()
            is_api_import = stripped.startswith("from openspec.api") or stripped.startswith(
                "import openspec.api"
            )
            if is_api_import:
                violations.append(f"{path.relative_to(SRC_ROOT)}:{line_no}: {stripped}")
    assert not violations, f"application/ imported api/: {violations}"


def test_api_never_imports_infrastructure_directly() -> None:
    """`api/` may only reach infrastructure through DI wiring in `api/deps.py` — the
    one composition-root file that is allowed to know concrete adapters exist
    (docs/05-backend.md §4)."""
    violations: list[str] = []
    for path in _iter_py_files("api"):
        if path.name == "deps.py":
            continue
        for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            stripped = line.strip()
            if stripped.startswith("from openspec.infrastructure") or stripped.startswith(
                "import openspec.infrastructure"
            ):
                violations.append(f"{path.relative_to(SRC_ROOT)}:{line_no}: {stripped}")
    assert not violations, f"api/ (outside deps.py) imported infrastructure/: {violations}"
