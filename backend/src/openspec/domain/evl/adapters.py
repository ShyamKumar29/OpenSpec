"""Adapts a pipeline-produced `AttributeValue` into the plain `Prediction`
shape `domain/evl/metrics.py` compares against a gold set (`EVL`, M1). Pure:
a field projection, no I/O (INV-6). Lives in `domain/evl/`, not
`application/`, because both `AttributeValue` and `Prediction` are domain
types — converting one to the other needs no port or orchestration.
"""

from __future__ import annotations

from openspec.domain.model.attribute import AttributeValue, AttributeValueUnknown
from openspec.domain.model.gold import Prediction


def prediction_from_attribute_value(
    *, record_id: str, field: str, value: AttributeValue
) -> Prediction:
    if isinstance(value, AttributeValueUnknown):
        return Prediction(
            record_id=record_id,
            field=field,
            value=None,
            unknown_reason=value.unknown_reason.value,
            status=value.status.value,
        )
    return Prediction(
        record_id=record_id,
        field=field,
        value=value.value_display,
        unknown_reason=None,
        status=value.status.value,
        evidence_count=len(value.evidence),
    )
