"""`BlobStore` — the port `ING`/`PRS` use to retain raw uploaded bytes
(docs/04-data-model.md §3.1 `import_batch.raw_blob_key`, §3.3 document blobs)
byte-identical to the source (FR-ING-7). M0 (`docs/10-roadmap.md`) scopes this
to `ING`'s need — writing a batch's raw bytes and reading them back by key —
not the full document/parse-artifact blob lifecycle `PRS` will need at M2.

Two adapters exist: `infrastructure/blob/local.py` (filesystem, real and
exercised) and `infrastructure/blob/s3.py` (boto3, unit-tested against a
mocked client — no live AWS credentials in this environment). Swapping one for
the other is a composition-root change in `api/deps.py` only, the same pattern
`application/ports/repositories.py` and `manufacturer_brand.py` already
establish for this project.
"""

from __future__ import annotations

from typing import Protocol


class BlobStore(Protocol):
    def put(self, *, key: str, data: bytes) -> str:
        """Writes `data` under `key` and returns the key actually stored under
        (adapters may namespace it further). Overwriting an existing key with
        identical bytes is safe and idempotent; overwriting with different
        bytes is the caller's responsibility to avoid — this port does not
        version blobs (`document_version.content_hash` is what does that, at
        the domain layer, per docs/04-data-model.md §3.3)."""
        ...

    def get(self, *, key: str) -> bytes:
        """Raises `BlobNotFound` if `key` was never written (or was written by
        a different adapter/namespace) — never returns `None`/empty bytes for
        a missing key, per CLAUDE.md's "contract violation -> crash loudly"."""
        ...

    def exists(self, *, key: str) -> bool: ...


class BlobNotFound(Exception):
    """`key` has no corresponding blob. Distinct from `TransientError`
    (`domain/errors.py`) — a missing key is a logic error at the call site,
    not a retryable infrastructure hiccup."""
