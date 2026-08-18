"""`S3BlobStore` — the `cloud` topology's `BlobStore` adapter (docs/07-devops.md
§3, docs/10-roadmap.md M0: "`BlobStore` port with local FS **and** S3
adapters"). Vendor SDK (`boto3`) named only here, per CLAUDE.md's "Vendors...
are named only in `infrastructure/`".

**Not exercised against a live bucket in this environment** — no AWS
credentials, no network egress to AWS beyond the initial `pip install` (the
same environment constraint `docs/15-backend-implementation-status.md` §3
already documents for Postgres). Correctness is proven instead against a
mocked `boto3` S3 client (`tests/unit/test_s3_blob_store.py`), the same
"architecture now, real backend later" discipline every UH milestone already
applied to reference-data adapters it couldn't reach real files for.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import boto3
from botocore.exceptions import ClientError

from openspec.application.ports.blob import BlobNotFound

if TYPE_CHECKING:
    from types_boto3_s3.client import S3Client


class S3BlobStore:
    def __init__(self, *, bucket: str, prefix: str = "", client: S3Client | None = None) -> None:
        self._bucket = bucket
        self._prefix = prefix
        self._client: S3Client = client if client is not None else boto3.client("s3")

    def _object_key(self, key: str) -> str:
        return f"{self._prefix}{key}" if self._prefix else key

    def put(self, *, key: str, data: bytes) -> str:
        self._client.put_object(Bucket=self._bucket, Key=self._object_key(key), Body=data)
        return key

    def get(self, *, key: str) -> bytes:
        try:
            response = self._client.get_object(Bucket=self._bucket, Key=self._object_key(key))
        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code")
            if error_code in ("NoSuchKey", "404"):
                raise BlobNotFound(key) from exc
            raise
        return response["Body"].read()

    def exists(self, *, key: str) -> bool:
        try:
            self._client.head_object(Bucket=self._bucket, Key=self._object_key(key))
        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code")
            if error_code in ("404", "NoSuchKey"):
                return False
            raise
        return True
