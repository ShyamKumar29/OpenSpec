"""`infrastructure/cls_resources.py` (`CLS`, M1) — loader tests, run against
both a small fixture file and the real shipped `resources/cls/` files."""

from __future__ import annotations

from pathlib import Path

from openspec.infrastructure.cls_resources import (
    DEFAULT_ABBREVIATIONS_PATH,
    DEFAULT_CLASSIFICATION_RULES_PATH,
    load_abbreviation_table,
    load_classification_rules,
)

_FIXTURE_DIR = Path(__file__).resolve().parents[1] / "fixtures" / "cls"


def test_real_shipped_abbreviations_load() -> None:
    table = load_abbreviation_table(DEFAULT_ABBREVIATIONS_PATH)
    assert table["BV"] == "ball valve"
    assert table["BRS"] == "brass"
    assert all(k == k.upper() for k in table)
    assert all(v == v.lower() for v in table.values())


def test_real_shipped_classification_rules_load() -> None:
    rules = load_classification_rules(DEFAULT_CLASSIFICATION_RULES_PATH)
    assert len(rules) == 1
    assert rules[0].class_code == "BALL_VALVE_BRONZE"
    assert frozenset({"brass", "bronze"}) in rules[0].required_keyword_groups


def test_fixture_abbreviations_load() -> None:
    table = load_abbreviation_table(_FIXTURE_DIR / "abbreviations.yaml")
    assert table == {"FOO": "foo expansion"}


def test_fixture_rules_load() -> None:
    rules = load_classification_rules(_FIXTURE_DIR / "classification_rules.yaml")
    assert len(rules) == 1
    assert rules[0].class_code == "FIXTURE_CLASS"
    assert rules[0].confidence == 0.5


def test_empty_rules_file_loads_as_empty_tuple() -> None:
    rules = load_classification_rules(_FIXTURE_DIR / "empty_rules.yaml")
    assert rules == ()
