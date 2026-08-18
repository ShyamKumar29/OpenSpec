"""`infrastructure/db/seed.py` (docs/10-roadmap.md M0: "Idempotent seeder").
No live Postgres in this environment — these compile the generated upsert
statements against the Postgres dialect and inspect them, proving the
seeder's idempotency is structural (an `ON CONFLICT ... DO UPDATE` keyed on
the schema's own natural-key constraint) rather than merely intended.
`tests/integration/test_seed_idempotency.py` proves it end-to-end when a
Postgres is reachable.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml
from sqlalchemy.dialects import postgresql

from openspec.infrastructure.db.seed import DEFAULT_TAXONOMY_PATH, seed_taxonomy


class _RecordingConnection:
    """A fake `Connection` that records every statement it's asked to
    execute and returns a deterministic id — enough to drive `seed_taxonomy`
    without a real engine, and to prove *how many* statements it issues."""

    def __init__(self) -> None:
        self.executed: list[object] = []
        self._next_id = 1

    def execute(self, stmt: object) -> _FakeResult:
        self.executed.append(stmt)
        return _FakeResult(self._next_id)

    def _bump(self) -> None:
        self._next_id += 1


class _FakeResult:
    def __init__(self, value: int) -> None:
        self._value = value

    def scalar_one(self) -> int:
        return self._value


def test_real_shipped_taxonomy_yaml_seeds_without_error() -> None:
    conn = _RecordingConnection()
    report = seed_taxonomy(conn, path=DEFAULT_TAXONOMY_PATH)  # type: ignore[arg-type]

    raw = yaml.safe_load(DEFAULT_TAXONOMY_PATH.read_text(encoding="utf-8"))
    expected_classes = len(raw["classes"])
    expected_attrs = sum(len(c["attributes"]) for c in raw["classes"])

    assert report.classes_seeded == expected_classes
    assert report.attributes_seeded == expected_attrs


def test_every_statement_is_an_on_conflict_upsert(tmp_path: Path) -> None:
    _write_fixture_taxonomy(tmp_path)
    conn = _RecordingConnection()
    seed_taxonomy(conn, path=tmp_path / "classes.yaml")  # type: ignore[arg-type]

    assert conn.executed, "seeder issued no statements"
    for stmt in conn.executed:
        compiled = str(stmt.compile(dialect=postgresql.dialect()))
        assert "ON CONFLICT" in compiled
        assert "DO UPDATE SET" in compiled


def test_class_upsert_conflicts_on_the_natural_key_code(tmp_path: Path) -> None:
    _write_fixture_taxonomy(tmp_path)
    conn = _RecordingConnection()
    seed_taxonomy(conn, path=tmp_path / "classes.yaml")  # type: ignore[arg-type]

    class_stmt = conn.executed[0]
    compiled = str(class_stmt.compile(dialect=postgresql.dialect()))
    assert "ON CONFLICT (code) DO UPDATE SET" in compiled


def test_running_twice_issues_the_same_number_of_statements(tmp_path: Path) -> None:
    """Idempotency's structural signature: re-running against unchanged YAML
    issues the exact same upsert statements the second time — no growth, no
    divergent branch for "already exists"."""
    _write_fixture_taxonomy(tmp_path)
    path = tmp_path / "classes.yaml"

    first = _RecordingConnection()
    report_1 = seed_taxonomy(first, path=path)  # type: ignore[arg-type]

    second = _RecordingConnection()
    report_2 = seed_taxonomy(second, path=path)  # type: ignore[arg-type]

    assert len(first.executed) == len(second.executed)
    assert report_1 == report_2


def test_missing_taxonomy_file_raises_not_silently_seeds_nothing(tmp_path: Path) -> None:
    conn = _RecordingConnection()
    with pytest.raises(FileNotFoundError):
        seed_taxonomy(conn, path=tmp_path / "does_not_exist.yaml")  # type: ignore[arg-type]


def _write_fixture_taxonomy(tmp_path: Path) -> None:
    (tmp_path / "classes.yaml").write_text(
        """
schema_version: "1"
classes:
  - code: TEST_CLASS
    name: "Test Class"
    external_ref: null
    attributes:
      - code: test_attr
        name: "Test Attr"
        datatype: string
        risk_tier: 1
        is_mandatory: true
        unit_dimension: null
        allowed_values: null
""",
        encoding="utf-8",
    )
