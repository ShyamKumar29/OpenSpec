"""UH0 — the missing-reference-dataset registry itself fails loudly and specifically
(`docs/16-unilog-alignment.md` UH0 §6/§8; `resources/reference/unihack/README.md`)."""

from __future__ import annotations

import pytest

from openspec.infrastructure.reference_data.errors import ReferenceDataMissing
from openspec.infrastructure.reference_data.missing_datasets import (
    MISSING_DATASETS,
    list_missing_datasets,
    require,
)

EXPECTED_NAMES = {
    "taxonomy_lov",
    "manufacturer_brand_list",
    "fittings_lov",
    "faucets_lov",
    "uom_standards",
    "decimal_fraction",
    "content_guidelines",
}


def test_registry_lists_every_dataset_the_docs_describe_but_this_env_lacks() -> None:
    names = {d.name for d in list_missing_datasets()}
    assert names == EXPECTED_NAMES


def test_every_entry_names_an_actual_expected_filename_and_doc_reference() -> None:
    for dataset in MISSING_DATASETS:
        assert dataset.expected_filename
        assert dataset.needed_for
        assert dataset.doc_ref


def test_require_raises_with_actionable_message() -> None:
    with pytest.raises(ReferenceDataMissing, match="Fittings_LOV.xlsx"):
        require("fittings_lov")


def test_require_unknown_name_is_a_programming_error_not_a_reference_data_error() -> None:
    with pytest.raises(KeyError):
        require("something_not_registered")
