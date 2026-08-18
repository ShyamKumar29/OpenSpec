"""Description-building use case (`DSC`, UH5 — ADR-0013,
docs/16-unilog-alignment.md UH5). Resolves a formula for one field+class,
assembles it from already-accepted attribute values, and runs whatever
character-limit/casing rules this project has a confirmed source for. Never
calls an LLM — templated assembly from verified data, per ADR-0013's decision.
"""

from __future__ import annotations

from dataclasses import dataclass

from openspec.application.ports.description_formulas import DescriptionFormulaReference
from openspec.domain.dsc.formula_engine import DescriptionBuildResult, build_description
from openspec.domain.dsc.validation import ValidationResult, run_field_validation
from openspec.domain.model.attribute import AttributeValue


@dataclass(frozen=True, slots=True)
class DescriptionBuilt:
    result: DescriptionBuildResult
    validations: tuple[ValidationResult, ...]

    @property
    def all_rules_passed(self) -> bool:
        return all(v.passed for v in self.validations)


@dataclass(frozen=True, slots=True)
class DescriptionBlocked:
    field_code: str
    class_code: str
    reason: str


DescriptionResolution = DescriptionBuilt | DescriptionBlocked


def build_field_description(
    *,
    field_code: str,
    class_code: str,
    attribute_values: dict[str, AttributeValue],
    formulas: DescriptionFormulaReference,
) -> DescriptionResolution:
    formula = formulas.formula_for(field_code=field_code, class_code=class_code)
    if formula is None:
        return DescriptionBlocked(
            field_code=field_code,
            class_code=class_code,
            reason=(
                "NO_FORMULA_CONFIGURED — resources/description-formulas/ has no entry for this "
                "field+class (UNILOG_INTERNAL_CONTENT_GUIDELINES.docx is missing, see "
                "infrastructure/reference_data/missing_datasets.py)"
            ),
        )
    result = build_description(formula, attribute_values)
    validations = run_field_validation(result.text, field_code)
    return DescriptionBuilt(result=result, validations=validations)
