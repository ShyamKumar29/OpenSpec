"""docs/05-backend.md §2, layering-test item 5: "AttributeValue has no construction
path that omits evidence." Distinct from tests/unit/test_attribute_value.py, which
tests *behaviour* — this test asserts the *shape* of the type itself, so it fails if
someone "fixes" the failing unit test by quietly giving `evidence` a default value
instead of fixing the caller.

UH1 (`docs/16-unilog-alignment.md` G1) widened `Evidence` to a tagged union —
`DocumentSpan | SourceRowSpan | ReferenceTableRow`. The done-criteria for UH1
explicitly calls for this file to cover all three variants: each must have no
default on its identity-bearing fields, the same "fabrication is unrepresentable,
not just rejected" property `AttributeValueAsserted.evidence` already has.
"""

from __future__ import annotations

import dataclasses

from openspec.domain.model.attribute import (
    AttributeValueAsserted,
    AttributeValueUnknown,
    DocumentSpan,
    ReferenceTableRow,
    SourceRowSpan,
)


def test_asserted_evidence_field_has_no_default() -> None:
    fields = {f.name: f for f in dataclasses.fields(AttributeValueAsserted)}
    evidence_field = fields["evidence"]
    assert evidence_field.default is dataclasses.MISSING
    assert evidence_field.default_factory is dataclasses.MISSING  # type: ignore[comparison-overlap]


def test_unknown_type_has_no_value_bearing_fields() -> None:
    """INV-4: `Unknown` cannot smuggle a value through a same-named field —
    `AttributeValueUnknown` simply has no `value_*` field to abuse."""
    field_names = {f.name for f in dataclasses.fields(AttributeValueUnknown)}
    assert not (field_names & {"value_display", "value_raw", "value_canonical"})
    assert "unknown_reason" in field_names


def _assert_no_default(cls: type, *field_names: str) -> None:
    fields = {f.name: f for f in dataclasses.fields(cls)}
    for name in field_names:
        f = fields[name]
        assert f.default is dataclasses.MISSING, f"{cls.__name__}.{name} must have no default"
        assert (
            f.default_factory is dataclasses.MISSING  # type: ignore[comparison-overlap]
        ), f"{cls.__name__}.{name} must have no default_factory"


def test_document_span_identity_fields_have_no_default() -> None:
    _assert_no_default(
        DocumentSpan,
        "document_version_id",
        "page",
        "region_id",
        "char_start",
        "char_end",
        "snippet_text",
        "bbox",
    )


def test_source_row_span_identity_fields_have_no_default() -> None:
    _assert_no_default(
        SourceRowSpan, "source_dataset", "row_identifier", "source_column", "snippet_text"
    )


def test_reference_table_row_identity_fields_have_no_default() -> None:
    _assert_no_default(
        ReferenceTableRow, "reference_dataset", "row_key", "reference_field", "snippet_text"
    )


def test_evidence_variants_each_carry_their_own_kind_discriminator() -> None:
    """Each variant's `kind` field has a fixed default and `init=False` — a caller
    cannot construct a `DocumentSpan` tagged as `SOURCE_ROW_SPAN` by passing a
    mismatched `kind`; the discriminator is derived from *which class* was built,
    not a free-form field a caller could get wrong."""
    for cls in (DocumentSpan, SourceRowSpan, ReferenceTableRow):
        kind_field = next(f for f in dataclasses.fields(cls) if f.name == "kind")
        assert kind_field.init is False
