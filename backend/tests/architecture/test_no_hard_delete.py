"""INV-8: audit is append-only, no hard deletes anywhere. Scans `infrastructure/` (the
only layer allowed to touch SQL/ORM session calls) for a bare SQL `DELETE` or a raw
`.delete()` ORM call. There is deliberately no allowlist/suppression mechanism here —
a soft delete is `UPDATE ... SET deleted_at = now()`, which this pattern does not
match, so the rule stays simple as the persistence layer grows.
"""

from __future__ import annotations

import re
from pathlib import Path

SRC_ROOT = Path(__file__).resolve().parents[2] / "src" / "openspec"

SQL_DELETE = re.compile(r"\bDELETE\s+FROM\b", re.IGNORECASE)
ORM_DELETE_CALL = re.compile(r"\.delete\s*\(")


def test_no_hard_delete_in_infrastructure() -> None:
    violations: list[str] = []
    infra = SRC_ROOT / "infrastructure"
    if not infra.exists():
        return
    for path in sorted(infra.rglob("*.py")):
        text = path.read_text(encoding="utf-8")
        for line_no, line in enumerate(text.splitlines(), start=1):
            if SQL_DELETE.search(line) or ORM_DELETE_CALL.search(line):
                violations.append(f"{path.relative_to(SRC_ROOT)}:{line_no}: {line.strip()}")
    assert not violations, f"Hard-delete pattern found in infrastructure/ (INV-8): {violations}"
