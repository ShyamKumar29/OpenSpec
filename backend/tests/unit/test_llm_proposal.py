"""`domain/ext/llm_proposal.py` — structured LLM extractor output validation
(M3, `docs/10-roadmap.md` M3 §5)."""

from __future__ import annotations

from openspec.domain.ext.llm_proposal import parse_extractor_response


def test_found_true_with_valid_span_parses() -> None:
    payload = '{"found": true, "char_start": 5, "char_end": 12, "rationale": "clear match"}'
    parsed = parse_extractor_response(payload)
    assert parsed is not None
    assert parsed.found is True
    assert parsed.char_start == 5
    assert parsed.char_end == 12


def test_found_false_parses_with_no_span() -> None:
    payload = '{"found": false, "rationale": "not stated anywhere"}'
    parsed = parse_extractor_response(payload)
    assert parsed is not None
    assert parsed.found is False
    assert parsed.char_start is None


def test_found_true_without_span_is_rejected() -> None:
    payload = '{"found": true, "rationale": "found it somewhere"}'
    assert parse_extractor_response(payload) is None


def test_found_false_with_a_span_is_rejected() -> None:
    payload = '{"found": false, "char_start": 0, "char_end": 3, "rationale": "?"}'
    assert parse_extractor_response(payload) is None


def test_char_end_not_greater_than_char_start_is_rejected() -> None:
    payload = '{"found": true, "char_start": 10, "char_end": 5, "rationale": "backwards"}'
    assert parse_extractor_response(payload) is None


def test_negative_offsets_are_rejected() -> None:
    payload = '{"found": true, "char_start": -1, "char_end": 5, "rationale": "bad"}'
    assert parse_extractor_response(payload) is None


def test_missing_rationale_is_rejected() -> None:
    payload = '{"found": true, "char_start": 0, "char_end": 3}'
    assert parse_extractor_response(payload) is None


def test_extra_field_is_rejected() -> None:
    payload = (
        '{"found": true, "char_start": 0, "char_end": 3, "rationale": "ok", '
        '"canonical_value": "invented normalisation"}'
    )
    assert parse_extractor_response(payload) is None


def test_non_json_is_rejected() -> None:
    assert parse_extractor_response("the value is 600 WOG") is None
