"""`S3BlobStore` (docs/10-roadmap.md M0: `BlobStore` port + S3 adapter) — unit
tested against a mocked `boto3` S3 client, per the adapter module's own
docstring: no live AWS credentials or bucket exist in this environment."""

from __future__ import annotations

import io
from typing import Any
from unittest.mock import MagicMock

import pytest
from botocore.exceptions import ClientError

from openspec.application.ports.blob import BlobNotFound
from openspec.infrastructure.blob.s3 import S3BlobStore


def _not_found_error(operation: str) -> ClientError:
    return ClientError({"Error": {"Code": "NoSuchKey", "Message": "not found"}}, operation)


def test_put_calls_put_object_with_bucket_key_and_body() -> None:
    client = MagicMock()
    store = S3BlobStore(bucket="openspec-blobs", client=client)

    store.put(key="batch_1/import.csv", data=b"hello")

    client.put_object.assert_called_once_with(
        Bucket="openspec-blobs", Key="batch_1/import.csv", Body=b"hello"
    )


def test_get_returns_the_object_body_bytes() -> None:
    client = MagicMock()
    client.get_object.return_value = {"Body": io.BytesIO(b"payload")}
    store = S3BlobStore(bucket="openspec-blobs", client=client)

    assert store.get(key="k") == b"payload"


def test_get_missing_key_raises_blob_not_found_not_client_error() -> None:
    client = MagicMock()
    client.get_object.side_effect = _not_found_error("GetObject")
    store = S3BlobStore(bucket="openspec-blobs", client=client)

    with pytest.raises(BlobNotFound):
        store.get(key="missing")


def test_get_other_client_error_propagates_unmodified() -> None:
    client = MagicMock()
    client.get_object.side_effect = ClientError(
        {"Error": {"Code": "AccessDenied", "Message": "nope"}}, "GetObject"
    )
    store = S3BlobStore(bucket="openspec-blobs", client=client)

    with pytest.raises(ClientError):
        store.get(key="k")


def test_exists_true_when_head_object_succeeds() -> None:
    client = MagicMock()
    client.head_object.return_value = {}
    store = S3BlobStore(bucket="openspec-blobs", client=client)

    assert store.exists(key="k") is True


def test_exists_false_on_404() -> None:
    client = MagicMock()
    client.head_object.side_effect = ClientError(
        {"Error": {"Code": "404", "Message": "not found"}}, "HeadObject"
    )
    store = S3BlobStore(bucket="openspec-blobs", client=client)

    assert store.exists(key="k") is False


def test_prefix_is_prepended_to_every_object_key() -> None:
    client: Any = MagicMock()
    client.get_object.return_value = {"Body": io.BytesIO(b"x")}
    store = S3BlobStore(bucket="openspec-blobs", prefix="imports/", client=client)

    store.put(key="k", data=b"x")
    store.get(key="k")

    assert client.put_object.call_args.kwargs["Key"] == "imports/k"
    assert client.get_object.call_args.kwargs["Key"] == "imports/k"
