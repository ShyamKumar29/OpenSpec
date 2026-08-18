"""Deterministic classification pre-pass (`CLS`, M1 —
docs/domain/pvf-reference.md §8: "the abbreviation dictionary... the
deterministic pre-pass that resolves ~40% of classification with no LLM
call"). Pure: takes an already-loaded abbreviation table and rule set (I/O
for reading `resources/cls/abbreviations.yaml` /
`resources/policy/classification_rules.yaml` lives in
`infrastructure/cls_resources.py`) and matches free text against them — no
LLM, no I/O, no randomness (INV-6), the same purity discipline
`domain/nrm/connections.py` already established for end-connection synonyms.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

AbbreviationTable = dict[str, str]  # UPPERCASE abbreviation -> lowercase expansion

_TOKEN_RE = re.compile(r"[A-Za-z0-9]+")


@dataclass(frozen=True, slots=True)
class ClassificationRule:
    """One deterministic rule: matches its `class_code` at `confidence` when
    every group in `required_keyword_groups` has at least one keyword
    present in the abbreviation-expanded text. A "group" is an OR-set (e.g.
    `{"brass", "bronze"}`) so a single rule can require "ball valve AND
    (brass OR bronze)" without a second rule per accepted material."""

    class_code: str
    required_keyword_groups: tuple[frozenset[str], ...]
    confidence: float

    def __post_init__(self) -> None:
        if not self.class_code.strip():
            raise ValueError("ClassificationRule.class_code must be non-blank")
        if not self.required_keyword_groups:
            raise ValueError("ClassificationRule.required_keyword_groups must be non-empty")
        if any(not group for group in self.required_keyword_groups):
            raise ValueError(
                "ClassificationRule.required_keyword_groups may not contain an empty group"
            )
        if not (0.0 <= self.confidence <= 1.0):
            raise ValueError(f"confidence out of range [0,1]: {self.confidence}")


def expand_abbreviations(text: str, table: AbbreviationTable) -> str:
    """Token-by-token expansion, case-insensitive, whole-token only — never a
    substring match, so `BV` inside `ABVX` is not expanded. Unrecognised
    tokens pass through lower-cased. Deterministic: same text + table, same
    output, every call (INV-6)."""
    tokens = _TOKEN_RE.findall(text)
    expanded = [table.get(tok.upper(), tok.lower()) for tok in tokens]
    return " ".join(expanded)


def _rule_matches(expanded_text: str, rule: ClassificationRule) -> bool:
    return all(
        any(keyword in expanded_text for keyword in group) for group in rule.required_keyword_groups
    )


def apply_rules(
    expanded_text: str, rules: tuple[ClassificationRule, ...]
) -> tuple[ClassificationRule, ...]:
    """Every rule that matches, in input order — the caller decides what to
    do with more than one match (tie-break, ambiguity) since that policy
    belongs to the orchestrating use case, not this pure matcher."""
    return tuple(rule for rule in rules if _rule_matches(expanded_text, rule))
