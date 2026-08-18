"""`domain/evl/gold_validation.py` (`EVL`, M1 brief §5/§8: "valid gold set,
malformed gold set, duplicate IDs, missing IDs")."""

from __future__ import annotations

from openspec.domain.evl.gold_validation import validate_gold_rows

_VALID_ROW = {
    "record_id": "r1",
    "field": "MFG_PART_NUM",
    "expected_value": "ABC-123",
    "expected_unknown_reason": "",
    "is_real": "true",
}


def test_valid_rows_produce_a_gold_set() -> None:
    gold_set, errors = validate_gold_rows(
        (_VALID_ROW,), source_name="fixture.csv", label_version="v0"
    )
    assert errors == ()
    assert gold_set is not None
    assert len(gold_set.labels) == 1
    assert gold_set.labels[0].expected_value == "ABC-123"


def test_missing_column_is_reported() -> None:
    row = dict(_VALID_ROW)
    del row["is_real"]
    gold_set, errors = validate_gold_rows((row,), source_name="fixture.csv", label_version="v0")
    assert gold_set is None
    assert len(errors) == 1
    assert errors[0].code == "MISSING_COLUMN"


def test_malformed_row_blank_record_id() -> None:
    row = dict(_VALID_ROW, record_id="  ")
    gold_set, errors = validate_gold_rows((row,), source_name="fixture.csv", label_version="v0")
    assert gold_set is None
    assert errors[0].code == "MALFORMED_ROW"


def test_duplicate_identifier_is_reported() -> None:
    gold_set, errors = validate_gold_rows(
        (_VALID_ROW, _VALID_ROW), source_name="fixture.csv", label_version="v0"
    )
    assert gold_set is None
    assert len(errors) == 1
    assert errors[0].code == "DUPLICATE_IDENTIFIER"


def test_invalid_is_real_value_is_reported() -> None:
    row = dict(_VALID_ROW, is_real="maybe")
    gold_set, errors = validate_gold_rows((row,), source_name="fixture.csv", label_version="v0")
    assert gold_set is None
    assert errors[0].code == "INVALID_VALUE"


def test_row_with_neither_value_nor_reason_is_invalid() -> None:
    row = dict(_VALID_ROW, expected_value="", expected_unknown_reason="")
    gold_set, errors = validate_gold_rows((row,), source_name="fixture.csv", label_version="v0")
    assert gold_set is None
    assert errors[0].code == "INVALID_VALUE"


def test_row_expecting_unknown_is_valid() -> None:
    row = dict(_VALID_ROW, expected_value="", expected_unknown_reason="NO_DOCUMENT_FOUND")
    gold_set, errors = validate_gold_rows((row,), source_name="fixture.csv", label_version="v0")
    assert errors == ()
    assert gold_set is not None
    assert gold_set.labels[0].expected_unknown_reason == "NO_DOCUMENT_FOUND"


def test_no_rows_at_all_is_invalid() -> None:
    gold_set, errors = validate_gold_rows((), source_name="fixture.csv", label_version="v0")
    assert gold_set is None
    assert len(errors) == 1


def test_multiple_distinct_rows_all_valid() -> None:
    rows = (
        _VALID_ROW,
        dict(_VALID_ROW, record_id="r2"),
        dict(_VALID_ROW, field="ITEM_DESCRIPTION"),
    )
    gold_set, errors = validate_gold_rows(rows, source_name="fixture.csv", label_version="v0")
    assert errors == ()
    assert gold_set is not None
    assert len(gold_set.labels) == 3


def test_deterministic_repeated_validation() -> None:
    rows = (_VALID_ROW, dict(_VALID_ROW, record_id="r2"))
    first = validate_gold_rows(rows, source_name="fixture.csv", label_version="v0")
    second = validate_gold_rows(rows, source_name="fixture.csv", label_version="v0")
    assert first == second
