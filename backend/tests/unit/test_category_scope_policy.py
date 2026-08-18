"""Tests for `infrastructure/category_scope_policy.py` (UH3 —
docs/16-unilog-alignment.md §4). The real shipped config is empty (see that
file's own header comment — no real Classpath prefixes exist without the
missing Unicat LOV workbook); this test proves the *parsing path* against a
non-empty fixture file, and separately proves the shipped file loads as the
documented empty configuration.
"""

from __future__ import annotations

from pathlib import Path

from openspec.domain.model.taxonomy import ProductCategory
from openspec.infrastructure.category_scope_policy import load_category_scope_rules


def test_real_shipped_config_is_empty() -> None:
    """Documents the current honest state: no real Classpath prefixes are
    configured because the source workbook doesn't exist in this environment."""
    assert load_category_scope_rules() == ()


def test_fixture_config_parses_rules(tmp_path: Path) -> None:
    p = tmp_path / "category_scope.yaml"
    p.write_text(
        "rules:\n"
        "  - category: FITTINGS\n"
        "    classpath_prefix: 'Plumbing>Fittings'\n"
        "  - category: FAUCETS\n"
        "    classpath_prefix: 'Plumbing>Faucets'\n",
        encoding="utf-8",
    )
    rules = load_category_scope_rules(p)
    assert len(rules) == 2
    assert rules[0].category == ProductCategory.FITTINGS
    assert rules[0].classpath_prefix.render() == "Plumbing>Fittings"
    assert rules[1].category == ProductCategory.FAUCETS


def test_empty_rules_key_loads_as_empty_tuple(tmp_path: Path) -> None:
    p = tmp_path / "category_scope.yaml"
    p.write_text("rules: []\n", encoding="utf-8")
    assert load_category_scope_rules(p) == ()
