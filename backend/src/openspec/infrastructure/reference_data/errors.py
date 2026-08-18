"""Reference-data failure taxonomy.

Distinct from `domain/errors.py`'s `DomainError` hierarchy — these are about the
*supplied files* being unreadable, structurally wrong, or absent, not about pipeline
stage outcomes. All three are meant to fail loudly (`docs/16-unilog-alignment.md`
UH0 §8/§9: "make bad reference data fail loudly"); nothing in this module is caught
and silently swallowed anywhere in `infrastructure/reference_data/`.
"""

from __future__ import annotations


class ReferenceDataError(Exception):
    """Base class. Never raised directly."""


class ReferenceDataMissing(ReferenceDataError):
    """A required reference file does not exist at the expected path — either the
    supplied file itself, or (via `missing_datasets.py`) a dataset the design docs
    describe that was never supplied to this environment at all."""


class ReferenceDataSchemaDrift(ReferenceDataError):
    """A supplied file's structure no longer matches what the loader/tests expect
    (column count, column names, column order, duplicate columns). Distinguished
    from `ReferenceDataMalformedRow` because this is a hard, whole-file failure —
    the file cannot safely be loaded at all, per UH0 §8's hard-failure/warning split."""


class ReferenceDataMalformedRow(ReferenceDataError):
    """A single row is structurally invalid (wrong column count, etc.). Raised by
    default; loaders that need to *tolerate* malformed rows and report them as a
    statistic instead say so explicitly at the call site — this exception is never
    caught and discarded silently."""
