"""Tests for `application/usecases/enrich_catalog_row.py` (UH4). Uses fake
ports (no reference data) — the honest state every real row is actually in
today; `test_enrichment_stats.py` covers the real-data run."""

from __future__ import annotations

from openspec.application.usecases.enrich_catalog_row import enrich_catalog_row
from openspec.application.usecases.resolve_manufacturer_brand import ResolutionPolicy
from openspec.domain.model.attribute import AttributeValueStatus, is_unknown

_POLICY = ResolutionPolicy(
    exact_confidence=1.0,
    normalized_exact_confidence=0.9,
    alias_confidence=0.85,
    fuzzy_accept_floor=0.8,
    fuzzy_ambiguity_delta=0.05,
)


def _id_factory(code: str) -> str:
    return f"test:{code}"


class TestEnrichCatalogRow:
    def test_verbatim_attributes_are_accepted_with_no_reference_data(self) -> None:
        result = enrich_catalog_row(
            row_number=1,
            mfg_part_num_raw="ACME-123",
            part_desc_raw="Widget, 1/2 in",
            part_manuf_raw="Acme Inc (1234)",
            dib_brand_raw="Acme",
            id_factory=_id_factory,
            created_at="2026-08-14T00:00:00Z",
            manufacturer_brand_reference=None,
            resolution_policy=_POLICY,
            part_manuf_placeholder_tokens=frozenset({"-"}),
            brand_placeholder_tokens=frozenset({"-- Unbranded --", "-- No DIB Brand --"}),
        )
        assert result.row_number == 1
        assert result.mfg_part_num.status is AttributeValueStatus.ACCEPTED  # type: ignore[union-attr]
        assert result.item_description.status is AttributeValueStatus.ACCEPTED  # type: ignore[union-attr]

    def test_manufacturer_and_brand_are_unknown_without_reference_data(self) -> None:
        result = enrich_catalog_row(
            row_number=1,
            mfg_part_num_raw="ACME-123",
            part_desc_raw="Widget",
            part_manuf_raw="Acme Inc (1234)",
            dib_brand_raw="Acme",
            id_factory=_id_factory,
            created_at="2026-08-14T00:00:00Z",
            manufacturer_brand_reference=None,
            resolution_policy=_POLICY,
            part_manuf_placeholder_tokens=frozenset({"-"}),
            brand_placeholder_tokens=frozenset({"-- Unbranded --", "-- No DIB Brand --"}),
        )
        assert is_unknown(result.manufacturer_name)
        assert result.manufacturer_name.unknown_reason.value == "REFERENCE_DATA_UNAVAILABLE"  # type: ignore[union-attr]
        assert is_unknown(result.brand_name)

    def test_placeholder_manufacturer_is_no_brand_declared_not_reference_unavailable(self) -> None:
        result = enrich_catalog_row(
            row_number=1,
            mfg_part_num_raw="ACME-123",
            part_desc_raw="Widget",
            part_manuf_raw="-",
            dib_brand_raw="Acme",
            id_factory=_id_factory,
            created_at="2026-08-14T00:00:00Z",
            manufacturer_brand_reference=None,
            resolution_policy=_POLICY,
            part_manuf_placeholder_tokens=frozenset({"-"}),
            brand_placeholder_tokens=frozenset({"-- Unbranded --", "-- No DIB Brand --"}),
        )
        assert result.manufacturer_name.unknown_reason.value == "NO_BRAND_DECLARED"  # type: ignore[union-attr]

    def test_ids_are_scoped_per_attribute_via_id_factory(self) -> None:
        calls: list[str] = []

        def recording_id_factory(code: str) -> str:
            calls.append(code)
            return f"id:{code}"

        enrich_catalog_row(
            row_number=1,
            mfg_part_num_raw="X",
            part_desc_raw="Y",
            part_manuf_raw="-",
            dib_brand_raw="-- Unbranded --",
            id_factory=recording_id_factory,
            created_at="2026-08-14T00:00:00Z",
            manufacturer_brand_reference=None,
            resolution_policy=_POLICY,
            part_manuf_placeholder_tokens=frozenset({"-"}),
            brand_placeholder_tokens=frozenset({"-- Unbranded --"}),
        )
        assert calls == ["MFG_PART_NUM", "ITEM_DESCRIPTION", "MANUFACTURER_NAME", "BRAND_NAME"]
