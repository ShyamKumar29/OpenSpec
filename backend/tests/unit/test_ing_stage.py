"""`application/stages/ing.py` (docs/10-roadmap.md M0: "ING module: CSV
import with column mapping, per-row error reporting")."""

from __future__ import annotations

import pytest

from openspec.application.stages.ing import (
    ColumnMappingUnresolved,
    ImportRowErrorCode,
    build_catalog_record,
    parse_csv_batch,
    resolve_column_mapping,
)

# ---- resolve_column_mapping ------------------------------------------------


def test_resolves_via_default_aliases() -> None:
    mapping = resolve_column_mapping(("Mfg_Part_Num", "Part_Desc", "Part_Manuf"))
    assert mapping == {
        "mpn": "Mfg_Part_Num",
        "description": "Part_Desc",
        "supplier_name": "Part_Manuf",
    }


def test_generic_aliases_also_resolve() -> None:
    mapping = resolve_column_mapping(("mpn", "description", "supplier"))
    assert mapping["mpn"] == "mpn"
    assert mapping["description"] == "description"
    assert mapping["supplier_name"] == "supplier"


def test_explicit_mapping_overrides_default_aliases() -> None:
    mapping = resolve_column_mapping(
        ("PN", "Notes"), explicit_mapping={"mpn": "PN", "description": "Notes"}
    )
    assert mapping == {"mpn": "PN", "description": "Notes"}


def test_explicit_mapping_referencing_a_missing_header_raises() -> None:
    with pytest.raises(ColumnMappingUnresolved):
        resolve_column_mapping(("PN",), explicit_mapping={"mpn": "PN", "description": "Nope"})


def test_unresolvable_required_field_raises_column_mapping_unresolved() -> None:
    with pytest.raises(ColumnMappingUnresolved):
        resolve_column_mapping(("foo", "bar"))


def test_supplier_name_is_optional_and_absent_when_unmappable() -> None:
    mapping = resolve_column_mapping(("mpn", "description"))
    assert "supplier_name" not in mapping


# ---- parse_csv_batch --------------------------------------------------------

_CSV = (
    "Mfg_Part_Num,Part_Desc,Part_Manuf\n"
    "ABC-123,1/2 BRS BALL VLV 600WOG,Apollo\n"
    ",Missing MPN row,Apollo\n"
    "XYZ-789,,Nibco\n"
    "ABC-123,Duplicate of row 1,Apollo\n"
    "DEF-456,Fine row,Nibco\n"
)


def test_parses_valid_rows() -> None:
    result = parse_csv_batch(_CSV)
    assert [r.mpn.raw for r in result.rows] == ["ABC-123", "DEF-456"]
    assert result.rows[0].mpn.canonical == "ABC123"
    assert result.rows[0].description_raw == "1/2 BRS BALL VLV 600WOG"
    assert result.rows[0].supplier_name == "Apollo"


def test_reports_missing_mpn_as_a_row_error() -> None:
    result = parse_csv_batch(_CSV)
    missing_mpn = [e for e in result.errors if e.error_code == ImportRowErrorCode.MISSING_MPN]
    assert len(missing_mpn) == 1
    assert missing_mpn[0].row_number == 2


def test_reports_missing_description_as_a_row_error() -> None:
    result = parse_csv_batch(_CSV)
    missing_desc = [
        e for e in result.errors if e.error_code == ImportRowErrorCode.MISSING_DESCRIPTION
    ]
    assert len(missing_desc) == 1
    assert missing_desc[0].row_number == 3


def test_reports_duplicate_mpn_within_batch() -> None:
    result = parse_csv_batch(_CSV)
    dupes = [e for e in result.errors if e.error_code == ImportRowErrorCode.DUPLICATE_MPN_IN_BATCH]
    assert len(dupes) == 1
    assert dupes[0].row_number == 4


def test_row_count_is_valid_rows_plus_errors() -> None:
    result = parse_csv_batch(_CSV)
    assert result.row_count == len(result.rows) + len(result.errors)
    assert result.row_count == 5


def test_malformed_row_wrong_column_count_is_reported() -> None:
    csv_text = "mpn,description\nABC,ok description\nDEF,too,many,fields\n"
    result = parse_csv_batch(csv_text)
    malformed = [e for e in result.errors if e.error_code == ImportRowErrorCode.MALFORMED_ROW]
    assert len(malformed) == 1
    assert malformed[0].row_number == 2


def test_header_only_file_produces_no_rows_and_no_errors() -> None:
    result = parse_csv_batch("mpn,description\n")
    assert result.rows == ()
    assert result.errors == ()


def test_empty_file_produces_empty_result_without_raising() -> None:
    result = parse_csv_batch("")
    assert result.rows == ()
    assert result.errors == ()
    assert result.column_mapping == {}


def test_unresolvable_columns_raise_before_any_row_is_processed() -> None:
    with pytest.raises(ColumnMappingUnresolved):
        parse_csv_batch("foo,bar\n1,2\n")


def test_parsing_is_deterministic() -> None:
    assert parse_csv_batch(_CSV) == parse_csv_batch(_CSV)


# ---- build_catalog_record ---------------------------------------------------


def test_build_catalog_record_from_a_parsed_row() -> None:
    result = parse_csv_batch(_CSV)
    record = build_catalog_record(
        result.rows[0],
        tenant_id="tenant_demo",
        source_batch_id="batch_1",
        created_at="2026-08-14T00:00:00Z",
        id_prefix="rec_batch_1",
    )
    assert record.mpn.raw == "ABC-123"
    assert record.mpn.canonical == "ABC123"
    assert record.tenant_id == "tenant_demo"
    assert record.source_batch_id == "batch_1"
    assert record.supplier_name == "Apollo"
