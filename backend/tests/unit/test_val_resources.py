"""`infrastructure/val_resources.py` loading the real, shipped
`resources/rules/ball_valve_bronze.yaml` (M3). Every rule here is transcribed from
`docs/domain/pvf-reference.md` §10 (see that file's own header comment) — these
tests exercise the *real* shipped rule set end to end through `domain/val/engine.py`,
not a hand-typed fixture."""

from __future__ import annotations

from types import SimpleNamespace

from openspec.domain.val.engine import evaluate_rules, results_for_attribute, worst_failure_severity
from openspec.domain.val.rule import RuleSeverity
from openspec.infrastructure.val_resources import load_all_validation_rules

_CLASS = "BALL_VALVE_BRONZE"


def _rules():
    return load_all_validation_rules()


def test_real_ruleset_loads_and_has_at_least_the_documented_starter_set() -> None:
    rules = _rules()
    # docs/domain/pvf-reference.md §10 names 12 rule IDs; this file expands two of
    # them (PRS-001, PRS-017) per pressure attribute and five (CLS-001) per enum
    # attribute — see the YAML's own header for the accounting.
    assert len(rules) == 18
    for rule in rules:
        assert rule.source  # every rule cites a primary source (constructor already enforces this)


def test_every_rule_targets_a_real_attribute_on_the_loaded_taxonomy() -> None:
    from openspec.infrastructure.taxonomy_loader import load_taxonomy

    taxonomy = load_taxonomy()
    ball_valve = taxonomy[_CLASS]
    known_attribute_codes = {a.code for a in ball_valve.attributes}
    for rule in _rules():
        for attribute_code in rule.attributes:
            assert attribute_code in known_attribute_codes, (
                f"{rule.rule_id} references unknown attribute {attribute_code!r}"
            )


class TestRealRulesAgainstRealFactShapes:
    def test_prs004_flags_out_of_typical_range(self) -> None:
        facts = {
            "body_material": "BRASS",
            "pressure_rating_wog": SimpleNamespace(magnitude=50, unit="psi", media="WOG"),
        }
        results = results_for_attribute(
            evaluate_rules(rules=_rules(), class_code=_CLASS, facts=facts), "pressure_rating_wog"
        )
        prs004 = next(r for r in results if r.rule_id == "PRS-004")
        assert not prs004.passed
        assert prs004.severity is RuleSeverity.FLAG

    def test_prs004_passes_within_typical_range(self) -> None:
        facts = {
            "body_material": "BRONZE",
            "pressure_rating_wog": SimpleNamespace(magnitude=600, unit="psi", media="WOG"),
        }
        results = results_for_attribute(
            evaluate_rules(rules=_rules(), class_code=_CLASS, facts=facts), "pressure_rating_wog"
        )
        prs004 = next(r for r in results if r.rule_id == "PRS-004")
        assert prs004.passed

    def test_prs011_flags_wsp_exceeding_wog(self) -> None:
        facts = {
            "pressure_rating_wsp": SimpleNamespace(magnitude=900, unit="psi", media="WSP"),
            "pressure_rating_wog": SimpleNamespace(magnitude=600, unit="psi", media="WOG"),
        }
        results = results_for_attribute(
            evaluate_rules(rules=_rules(), class_code=_CLASS, facts=facts), "pressure_rating_wsp"
        )
        prs011 = next(r for r in results if r.rule_id == "PRS-011")
        assert not prs011.passed

    def test_end007_blocks_solvent_weld_on_a_metal_body(self) -> None:
        facts = {"end_connection_inlet": "SOLVENT_WELD", "body_material": "BRASS"}
        results = results_for_attribute(
            evaluate_rules(rules=_rules(), class_code=_CLASS, facts=facts), "end_connection_inlet"
        )
        end007 = next(r for r in results if r.rule_id == "END-007")
        assert not end007.passed
        assert end007.severity is RuleSeverity.BLOCK

    def test_cls001_blocks_out_of_vocabulary_body_material(self) -> None:
        facts = {"body_material": "TITANIUM"}
        results = results_for_attribute(
            evaluate_rules(rules=_rules(), class_code=_CLASS, facts=facts), "body_material"
        )
        assert worst_failure_severity(results) is RuleSeverity.BLOCK

    def test_a_clean_ball_valve_record_passes_every_applicable_rule(self) -> None:
        facts = {
            "body_material": "BRASS",
            "end_connection_inlet": "NPT_FEMALE",
            "nominal_size": SimpleNamespace(standard="NPS", magnitude=0.5, display="1/2"),
            "pressure_rating_wog": SimpleNamespace(magnitude=600, unit="psi", media="WOG"),
            "pressure_rating_wsp": SimpleNamespace(magnitude=150, unit="psi", media="WSP"),
            "seat_material": "PTFE",
            "handle_type": "LEVER",
            "potable_water_listing": "NSF_61",
            "ansi_class": "150",
            "lead_free_compliance": True,
            "lead_free_compliance_provenance": "EXTRACTED",
        }
        results = evaluate_rules(rules=_rules(), class_code=_CLASS, facts=facts)
        failing = [r for r in results if not r.passed]
        assert failing == []
