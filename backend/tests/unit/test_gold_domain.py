"""`domain/model/gold.py` (`EVL`, M1)."""

from __future__ import annotations

import pytest

from openspec.domain.errors import InvariantViolation
from openspec.domain.model.gold import GoldLabel, GoldSet, Prediction


def _label(**overrides: object) -> GoldLabel:
    defaults: dict[str, object] = {
        "record_id": "r1",
        "field": "MFG_PART_NUM",
        "expected_value": "ABC-123",
        "expected_unknown_reason": None,
        "is_real": True,
    }
    defaults.update(overrides)
    return GoldLabel(**defaults)  # type: ignore[arg-type]


def test_label_requires_either_value_or_reason() -> None:
    with pytest.raises(InvariantViolation):
        _label(expected_value=None, expected_unknown_reason=None)


def test_label_rejects_both_value_and_reason() -> None:
    with pytest.raises(InvariantViolation):
        _label(expected_value="x", expected_unknown_reason="NO_DOCUMENT_FOUND")


def test_label_rejects_blank_record_id() -> None:
    with pytest.raises(InvariantViolation):
        _label(record_id="  ")


def test_label_rejects_blank_field() -> None:
    with pytest.raises(InvariantViolation):
        _label(field="")


def test_label_expecting_unknown_is_valid() -> None:
    label = _label(expected_value=None, expected_unknown_reason="NO_DOCUMENT_FOUND")
    assert label.expected_unknown_reason == "NO_DOCUMENT_FOUND"


def test_gold_set_requires_at_least_one_label() -> None:
    with pytest.raises(InvariantViolation):
        GoldSet(labels=(), source_name="x", label_version="v0")


def test_gold_set_record_ids_and_fields() -> None:
    gs = GoldSet(
        labels=(
            _label(record_id="r1", field="A"),
            _label(record_id="r2", field="B"),
            _label(record_id="r1", field="B"),
        ),
        source_name="x",
        label_version="v0",
    )
    assert gs.record_ids() == {"r1", "r2"}
    assert gs.fields() == {"A", "B"}


def test_gold_set_real_labels_filters() -> None:
    gs = GoldSet(
        labels=(
            _label(record_id="r1", field="A", is_real=True),
            _label(record_id="r2", field="A", is_real=False),
        ),
        source_name="x",
        label_version="v0",
    )
    assert [label.record_id for label in gs.real_labels()] == ["r1"]


def test_prediction_rejects_both_value_and_reason() -> None:
    with pytest.raises(InvariantViolation):
        Prediction(
            record_id="r1",
            field="A",
            value="x",
            unknown_reason="NO_DOCUMENT_FOUND",
            status="ACCEPTED",
        )


def test_prediction_rejects_negative_evidence_count() -> None:
    with pytest.raises(InvariantViolation):
        Prediction(
            record_id="r1",
            field="A",
            value="x",
            unknown_reason=None,
            status="ACCEPTED",
            evidence_count=-1,
        )


def test_prediction_unknown_shape() -> None:
    p = Prediction(
        record_id="r1", field="A", value=None, unknown_reason="NO_DOCUMENT_FOUND", status="UNKNOWN"
    )
    assert p.value is None
    assert p.unknown_reason == "NO_DOCUMENT_FOUND"
